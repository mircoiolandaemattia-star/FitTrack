import type { NextFunction, Request, RequestHandler, Response } from "express";
import { HttpError } from "../api/errors";
import type { ApiRequest, Handler } from "../api/types";

/** Traduce la richiesta Express nel tipo puro che capiscono gli handler. */
export function toApiRequest(req: Request): ApiRequest {
  if (!req.user_id) {
    // Difesa: `wrap` va montato solo dietro `requireAuth` (vedi app.ts).
    throw new HttpError(401, "UNAUTHENTICATED", "Utente non autenticato.");
  }
  return {
    user_id: req.user_id,
    params: (req.params ?? {}) as Record<string, string>,
    query: (req.query ?? {}) as Record<string, unknown>,
    body: req.body as unknown,
  };
}

/**
 * Thin wrapper: parsing input → handler puro → output.
 * Nessuna logica di business: se l'handler lancia, l'errore finisce
 * nell'adapter centralizzato via `next`.
 */
export function wrap(handler: Handler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(toApiRequest(req)).then(
      (response) => {
        res.status(response.status);
        if (response.body === undefined) {
          res.end();
        } else {
          res.json(response.body);
        }
      },
      (error: unknown) => next(error),
    );
  };
}
