import { createPublicKey, type JsonWebKeyInput } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { HttpError } from "../api/errors";

declare global {
  namespace Express {
    interface Request {
      /** Popolato da `requireAuth`: claim `sub` del JWT Supabase verificato. */
      user_id?: string;
      /** Popolato da `requireAuth`: claim `email` del JWT (opzionale, vedi sotto). */
      email?: string;
    }
  }
}

/** Token verificato: identità dell'utente, sempre estratta dal JWT. */
export interface VerifiedToken {
  user_id: string;
  /**
   * Claim `email`: presente nei token di chi si autentica via email, assente
   * per altri canali (es. telefono). Opzionale: gli handler che ne hanno
   * bisogno gestiscono l'assenza.
   */
  email?: string;
}

/** Estrae il token da `Authorization: Bearer <token>`, altrimenti 401. */
function bearerToken(req: Request): string {
  const header = req.headers.authorization;
  if (!header) {
    throw new HttpError(
      401,
      "UNAUTHENTICATED",
      'Header "Authorization: Bearer <token>" mancante.',
    );
  }
  const [scheme, token, ...rest] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token || rest.length > 0) {
    throw new HttpError(
      401,
      "UNAUTHENTICATED",
      "Formato token non valido: usa Authorization: Bearer <token>.",
    );
  }
  return token;
}

function unauthenticated(): HttpError {
  return new HttpError(401, "UNAUTHENTICATED", "Token non valido.");
}

/**
 * Header del JWT **senza verificarlo**: serve solo a scegliere l'algoritmo
 * e la chiave giusta. Un header falsificato comunque non passa la verifica
 * della firma più sotto.
 */
function decodeHeader(token: string): { alg?: unknown; kid?: unknown } {
  const [encoded, ...rest] = token.split(".");
  if (!encoded || rest.length !== 2) throw unauthenticated();
  try {
    const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as { alg?: unknown; kid?: unknown };
    }
  } catch {
    // header non JSON → cade nel 401 sotto
  }
  throw unauthenticated();
}

/** Esegue `verify` mappando ogni esito su 401 (scaduto vs. generico). */
function verifyOrFail(verify: () => string | jwt.JwtPayload): jwt.JwtPayload {
  try {
    const payload = verify();
    if (typeof payload === "string") throw unauthenticated();
    return payload;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof jwt.TokenExpiredError) {
      throw new HttpError(401, "UNAUTHENTICATED", "Token scaduto.");
    }
    // firma errata, token malformato, ecc.: dettagli non esposti
    throw unauthenticated();
  }
}

/* --------------------------- Chiavi ES256 (JWKS) --------------------------- */

/** Cache delle chiavi pubbliche: TTL lungo + un solo fetch alla volta. */
const JWKS_TTL_MS = 10 * 60_000;
const JWKS_TIMEOUT_MS = 5_000;
/** Distanza minima fra due refresh forzati (kid ignoto → rotazione chiavi). */
const JWKS_FORCE_COOLDOWN_MS = 60_000;

interface JwksCache {
  fetchedAt: number;
  /** `kid` → chiave pubblica PEM, pronta per `jwt.verify`. */
  keys: Map<string, string>;
}

let jwksCache: JwksCache | null = null;
let jwksPending: Promise<JwksCache> | null = null;
let jwksForcedAt = 0;

/**
 * Scarica `SUPABASE_JWKS_URL` (una richiesta alla volta, con timeout) e lo
 * tiene in cache per 10 minuti. `force` serve al refresh di rotazione.
 */
function loadJwks(force: boolean): Promise<JwksCache> {
  const url = process.env.SUPABASE_JWKS_URL;
  if (!url) {
    return Promise.reject(
      new HttpError(500, "SERVER_MISCONFIGURED", "SUPABASE_JWKS_URL non configurata sul server."),
    );
  }
  if (!force && jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return Promise.resolve(jwksCache);
  }
  if (jwksPending) return jwksPending;

  jwksPending = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), JWKS_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as {
        keys?: (JsonWebKeyInput["key"] & { kid?: string })[];
      };
      const keys = new Map<string, string>();
      for (const jwk of body.keys ?? []) {
        if (typeof jwk.kid !== "string") continue;
        // JWK → PEM pubblico: è la chiave con cui si verifica la firma.
        keys.set(
          jwk.kid,
          createPublicKey({ key: jwk, format: "jwk" }).export({ type: "spki", format: "pem" }) as string,
        );
      }
      jwksCache = { fetchedAt: Date.now(), keys };
      return jwksCache;
    } catch (error) {
      // Supabase non raggiungibile / JWKS malformato: non è un problema del
      // client, quindi resta un 5xx con un messaggio esplicito.
      const detail = error instanceof Error ? error.message : "errore sconosciuto";
      throw new HttpError(500, "SERVER_MISCONFIGURED", `JWKS irraggiungibile (${url}): ${detail}`);
    } finally {
      clearTimeout(timer);
      jwksPending = null;
    }
  })();

  return jwksPending;
}

/** Chiave pubblica PEM per il `kid` dichiarato dal token. */
async function resolveJwksKey(kid: string): Promise<string> {
  const key = (await loadJwks(false)).keys.get(kid);
  if (key) return key;
  // Rotazione delle chiavi Supabase: un solo refresh forzato ogni minuto,
  // così token con kid ignoto non provocano un fetch per richiesta.
  if (Date.now() - jwksForcedAt >= JWKS_FORCE_COOLDOWN_MS) {
    jwksForcedAt = Date.now();
    const refreshed = (await loadJwks(true)).keys.get(kid);
    if (refreshed) return refreshed;
  }
  // kid ignoto anche dopo il refresh: firma di un "Supabase" che non è il nostro.
  throw unauthenticated();
}

/* ------------------------------- Verifica -------------------------------- */

/**
 * Verifica il token emesso da Supabase Auth. Due firme possibili:
 *
 * - **HS256** (chiavi simmetriche: anon/service key e progetti col
 *   `JWT Secret`) → confronto con `SUPABASE_JWT_SECRET`;
 * - **ES256** (firma asimmetrica con cui Supabase Auth emette i token
 *   utente moderni) → chiave pubblica dal JWKS di `SUPABASE_JWKS_URL`.
 *
 * In entrambi i casi `algorithms` è esplicito (niente `alg=none` né
 * confusione di algoritmo) e vale la scadenza `exp`. Restituisce il `sub`
 * (uuid dell'utente) o lancia 401.
 *
 * Non reinventiamo login/registrazione/refresh: restano lato Supabase Auth,
 * qui verifichiamo solo i token che il client ci presenta.
 */
export async function verifySupabaseToken(token: string): Promise<VerifiedToken> {
  const header = decodeHeader(token);
  let payload: jwt.JwtPayload;

  if (header.alg === "HS256") {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) {
      // Configurazione mancante: non è un problema del client, va a 5xx
      throw new HttpError(
        500,
        "SERVER_MISCONFIGURED",
        "SUPABASE_JWT_SECRET non configurata sul server.",
      );
    }
    payload = verifyOrFail(() => jwt.verify(token, secret, { algorithms: ["HS256"] }));
  } else if (header.alg === "ES256") {
    if (typeof header.kid !== "string") throw unauthenticated();
    const publicKey = await resolveJwksKey(header.kid);
    payload = verifyOrFail(() => jwt.verify(token, publicKey, { algorithms: ["ES256"] }));
  } else {
    // alg=none, RS256, HS384…: nessun algoritmo fuori lista viene accettato
    throw unauthenticated();
  }

  if (!payload.sub) {
    // La anon key di Supabase non ha `sub`: viene scartata qui
    throw new HttpError(401, "UNAUTHENTICATED", "Token senza utente (claim sub assente).");
  }
  return {
    user_id: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
  };
}

/**
 * Middleware per tutte le route `/api`: verifica il token e popola
 * `req.user_id` (e `req.email`, claim opzionale). Gli errori finiscono
 * nell'adapter centralizzato. Può essere async: il JWKS va scaricato la
 * prima volta che arriva un token ES256.
 */
export const requireAuth: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const { user_id, email } = await verifySupabaseToken(bearerToken(req));
    req.user_id = user_id;
    req.email = email;
    next();
  } catch (error) {
    next(error);
  }
};
