import { z } from "zod";
import { HttpError } from "../errors";

/**
 * Wrapper **unico** sull'API generativa di Google Gemini: ogni endpoint
 * `/api/ai/*` passa da qui, così autenticazione, timeout e traduzione degli
 * errori stanno in un solo posto.
 *
 * - La chiave (`GEMINI_API_KEY`) vive solo nel backend: non viene mai
 *   esposta al client (nessun `EXPO_PUBLIC_`, nessun refuso nel bundle).
 * - Tutti gli errori sono `HttpError`: l'adapter centralizzato di
 *   `errors.ts` li converte nella risposta HTTP senza codici sparsi.
 *
 * Codici restituiti:
 * - `GEMINI_NOT_CONFIGURED`  503  chiave assente sul server
 * - `GEMINI_TIMEOUT`         504  nessuna risposta entro il timeout
 * - `GEMINI_RATE_LIMITED`    429  quota/giorno esaurita da Google
 * - `GEMINI_AUTH_ERROR`      502  chiave rifiutata da Google
 * - `GEMINI_UNAVAILABLE`     502  rete/DNS/connessione a Google rotta
 * - `GEMINI_ERROR`           502  risposta HTTP non positiva da Google
 * - `GEMINI_BLOCKED`         502  richiesta bloccata dai filtri di Google
 * - `GEMINI_INVALID_RESPONSE`502  corpo non JSON, vuoto o non valido
 */
const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_TIMEOUT_MS = 45_000;

export interface GeminiAttachment {
  /** MIME type dell'allegato (`image/jpeg`, `image/png`, `application/pdf`). */
  mimeType: string;
  /** Contenuto base64 **senza** il prefisso `data:...;base64,`. */
  data: string;
}

export interface GeminiRequest<T> {
  /** Domanda vera e propria (contiene anche le istruzioni di formato JSON). */
  prompt: string;
  /** Istruzioni di sistema: ruolo e regole generali (opzionale). */
  system?: string;
  /** Foto del pasto o PDF della scheda/dieta (opzionale). */
  attachments?: GeminiAttachment[];
  /**
   * Schema zod della risposta: se presente la risposta va trattata come JSON
   * (mime `application/json`) e viene validata qui, altrimenti torna testo.
   */
  schema?: z.ZodType<T>;
  /** Temperatura di campionamento (default del modello se omessa). */
  temperature?: number;
}

/** Interazione JSON restituita da Gemini: solo il testo della prima candidata. */
interface GenerateContentResponse {
  candidates?: {
    content?: { parts?: { text?: unknown }[] };
    finishReason?: unknown;
  }[];
  promptFeedback?: { blockReason?: unknown };
}

function envTimeoutMs(): number {
  const raw = Number(process.env.GEMINI_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

/** Testo utile (tracciato) di un body di errore Google, senza rumorosità. */
function snippet(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 300 ? `${clean.slice(0, 300)}…` : clean;
}

/** Mappa lo status HTTP di Google su un `HttpError` con codice proprio. */
function googleStatusError(status: number, body: string): HttpError {
  const details = { googleStatus: status, body: snippet(body) };
  if (status === 429) {
    return new HttpError(
      429,
      "GEMINI_RATE_LIMITED",
      "Limite di richieste raggiunto su Gemini: riprova tra qualche minuto.",
      details,
    );
  }
  if (status === 401 || status === 403) {
    return new HttpError(
      502,
      "GEMINI_AUTH_ERROR",
      "Gemini ha rifiutato le credenziali del server (GEMINI_API_KEY non valida).",
      details,
    );
  }
  return new HttpError(
    502,
    "GEMINI_ERROR",
    `Gemini ha risposto con un errore (${status}).`,
    details,
  );
}

/** Testo concatenato delle parti di testo di una candidata. */
function candidateText(payload: GenerateContentResponse): string {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("");
}

/**
 * Unica porta d'ingresso alle chiamate Gemini.
 *
 * Costruisce il body (`contents` + eventuali allegati inline), esegue la
 * richiesta con timeout, traduce ogni esito (rete, status Google, corpo
 * malformato) in `HttpError` e, se `schema` è presente, valida il JSON
 * generato. Gli endpoint non fanno altro che passare prompt e schema.
 */
export async function generateGemini<T = string>(request: GeminiRequest<T>): Promise<T> {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new HttpError(
      503,
      "GEMINI_NOT_CONFIGURED",
      "Funzione AI non configurata: variabile GEMINI_API_KEY assente sul server.",
    );
  }

  const model = (process.env.GEMINI_MODEL ?? "").trim() || DEFAULT_MODEL;
  const baseUrl = (process.env.GEMINI_API_BASE ?? "")
    .trim()
    .replace(/\/+$/, "") || "https://generativelanguage.googleapis.com";

  const parts: Record<string, unknown>[] = [{ text: request.prompt }];
  for (const attachment of request.attachments ?? []) {
    // Forma canonica (camelCase) della REST API di Google: `inlineData`
    // con `mimeType` + `data`, la stessa che usa il riferimento ufficiale.
    parts.push({
      inlineData: { mimeType: attachment.mimeType, data: attachment.data },
    });
  }

  const payload = {
    contents: [{ role: "user", parts }],
    ...(request.system
      ? { systemInstruction: { parts: [{ text: request.system }] } }
      : {}),
    generationConfig: {
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      // Chiede a Gemini JSON puro quando serve una struttura tipizzata
      ...(request.schema ? { responseMimeType: "application/json" } : {}),
    },
  };

  const timeoutMs = envTimeoutMs();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let status: number;
  let raw: string;
  try {
    const response = await fetch(`${baseUrl}/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    status = response.status;
    raw = await response.text();
  } catch (error) {
    if (controller.signal.aborted) {
      throw new HttpError(
        504,
        "GEMINI_TIMEOUT",
        `Gemini non ha risposto entro ${timeoutMs} ms.`,
      );
    }
    throw new HttpError(502, "GEMINI_UNAVAILABLE", "Servizio Gemini irraggiungibile.", {
      cause: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timer);
  }

  if (!status || status < 200 || status >= 300) {
    throw googleStatusError(status, raw);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(
      502,
      "GEMINI_INVALID_RESPONSE",
      "Risposta di Gemini non interpretabile (JSON malformato).",
      { body: snippet(raw) },
    );
  }

  const content = (typeof parsed === "object" && parsed !== null
    ? parsed
    : {}) as GenerateContentResponse;

  const blockReason = content.promptFeedback?.blockReason;
  if (typeof blockReason === "string") {
    throw new HttpError(
      502,
      "GEMINI_BLOCKED",
      "Gemini ha bloccato la richiesta (filtri di sicurezza).",
      { blockReason },
    );
  }

  const text = candidateText(content).trim();
  if (!text) {
    throw new HttpError(
      502,
      "GEMINI_INVALID_RESPONSE",
      "Gemini ha restituito una risposta vuota.",
      { body: snippet(raw) },
    );
  }

  if (!request.schema) return text as unknown as T;

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // Gemini a volte avvolge il JSON in ```json … ```: si riprova senza i fence
    const unfenced = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try {
      json = JSON.parse(unfenced);
    } catch {
      throw new HttpError(
        502,
        "GEMINI_INVALID_RESPONSE",
        "Gemini non ha restituito JSON valido.",
        { body: snippet(text) },
      );
    }
  }

  const result = request.schema.safeParse(json);
  if (!result.success) {
    throw new HttpError(
      502,
      "GEMINI_INVALID_RESPONSE",
      "La risposta di Gemini non rispetta la struttura attesa.",
      {
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    );
  }
  return result.data;
}
