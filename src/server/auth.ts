import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { HttpError } from "../api/errors";

declare global {
  namespace Express {
    interface Request {
      /** Popolato da `requireAuth`: claim `sub` del JWT Supabase verificato. */
      user_id?: string;
    }
  }
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

/**
 * Verifica il token emesso da Supabase Auth: firma HS256 contro
 * `SUPABASE_JWT_SECRET` + scadenza (`exp`, già gestita da `verify`).
 * Restituisce il `sub` (uuid dell'utente) o lancia 401.
 *
 * Non reinventiamo login/registrazione/refresh: restano lato Supabase Auth,
 * qui verifichiamo solo i token che il client ci presenta.
 */
export function verifySupabaseToken(token: string): string {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    // Configurazione mancante: non è un problema del client, va a 5xx
    throw new HttpError(
      500,
      "SERVER_MISCONFIGURED",
      "SUPABASE_JWT_SECRET non configurata sul server.",
    );
  }

  let payload: string | jwt.JwtPayload;
  try {
    // `algorithms` esplicito: niente alg=none / confusione RS256
    payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new HttpError(401, "UNAUTHENTICATED", "Token scaduto.");
    }
    // firma errata, token malformato, ecc.: dettagli non esposti
    throw new HttpError(401, "UNAUTHENTICATED", "Token non valido.");
  }

  if (typeof payload === "string" || !payload.sub) {
    // La anon key di Supabase non ha `sub`: viene scartata qui
    throw new HttpError(401, "UNAUTHENTICATED", "Token senza utente (claim sub assente).");
  }
  return payload.sub;
}

/**
 * Middleware per tutte le route `/api`: verifica il token e popola
 * `req.user_id`. Gli errori finiscono nell'adapter centralizzato.
 */
export const requireAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  try {
    req.user_id = verifySupabaseToken(bearerToken(req));
    next();
  } catch (error) {
    next(error);
  }
};
