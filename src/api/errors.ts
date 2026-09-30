/**
 * Adapter degli errori: l'unico punto del progetto che traduce un'eccezione
 * in una risposta HTTP. Gli handler non conoscono Express e non codificano
 * status code per gli errori: lanciano (HttpError, ZodError, errori Prisma)
 * e qui arrivano tutte le eccezioni, incluse quelle del body parser
 * (JSON malformato).
 */
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Errore esplicito e voluto dagli handler (404, 400 di dominio, ...). */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static notFound(resource: string, id: string): HttpError {
    return new HttpError(404, "NOT_FOUND", `${resource} '${id}' non trovato`);
  }

  static badRequest(message: string, details?: unknown): HttpError {
    return new HttpError(400, "BAD_REQUEST", message, details);
  }
}

/** Errore del body parser di Express (`express.json()`). */
type BodyParserError = Error & { type?: string; status?: number };

/**
 * I parser di Express marcano i loro errori con `type`
 * (`entity.parse.failed`, `entity.too.large`, `charset.unsupported`, …).
 * Non tutti sono `SyntaxError` (solo il JSON malformato lo è): senza
 * controllare solo `type`, un corpo troppo grande cadrebbe nel ramo 500
 * invece che nel 413 documentato qui sotto.
 */
function isBodyParserError(error: unknown): error is BodyParserError {
  if (!(error instanceof Error)) return false;
  return typeof (error as { type?: unknown }).type === "string";
}

function zodDetails(error: ZodError): unknown[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

function prismaResponse(error: Prisma.PrismaClientKnownRequestError): {
  status: number;
  body: ErrorBody;
} {
  switch (error.code) {
    // Vincolo di unicità violato (es. email duplicata)
    case "P2002":
      return {
        status: 409,
        body: {
          error: {
            code: "UNIQUE_VIOLATION",
            message: "Vincolo di unicità violato: record già esistente.",
            details: error.meta,
          },
        },
      };
    // Foreign key violata: la risorsa referenziata non esiste
    case "P2003":
      return {
        status: 422,
        body: {
          error: {
            code: "FOREIGN_KEY_VIOLATION",
            message: "Risorsa referenziata inesistente.",
            details: error.meta,
          },
        },
      };
    // Operazione su record che non esiste più (update/delete)
    case "P2025":
      return {
        status: 404,
        body: {
          error: {
            code: "NOT_FOUND",
            message:
              typeof error.meta?.cause === "string"
                ? error.meta.cause
                : "Record non trovato.",
          },
        },
      };
    default:
      return {
        status: 500,
        body: {
          error: {
            code: "INTERNAL_ERROR",
            message: "Errore interno del server.",
            details: { prismaCode: error.code },
          },
        },
      };
  }
}

/** Mappa qualunque errore a una risposta HTTP coerente. */
export function toErrorResponse(error: unknown): {
  status: number;
  body: ErrorBody;
} {
  if (error instanceof HttpError) {
    const body: ErrorBody = { error: { code: error.code, message: error.message } };
    if (error.details !== undefined) body.error.details = error.details;
    return { status: error.status, body };
  }

  if (error instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          message: "Dati di input non validi.",
          details: zodDetails(error),
        },
      },
    };
  }

  if (isBodyParserError(error)) {
    const status = error.status ?? 400;
    if (error.type === "entity.parse.failed") {
      return {
        status: 400,
        body: {
          error: { code: "INVALID_JSON", message: "JSON malformato nel corpo della richiesta." },
        },
      };
    }
    return {
      status,
      body: {
        error: {
          code: error.type === "entity.too.large" ? "PAYLOAD_TOO_LARGE" : "INVALID_BODY",
          message: "Corpo della richiesta non elaborabile.",
          details: error.type ? { type: error.type } : undefined,
        },
      },
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return prismaResponse(error);
  }

  // DB non raggiungibile / credenziali errate: utile per il debug su Render
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: 503,
      body: {
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "Database non raggiungibile.",
        },
      },
    };
  }

  // Errore di programmazione lato server (non è un input dell'utente)
  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      status: 500,
      body: {
        error: { code: "INTERNAL_ERROR", message: "Errore interno del server." },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: { code: "INTERNAL_ERROR", message: "Errore interno del server." },
    },
  };
}
