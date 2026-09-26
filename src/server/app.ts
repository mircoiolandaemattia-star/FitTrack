import cors from "cors";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { HttpError, toErrorResponse } from "../api/errors";
import { requireAuth } from "./auth";
import { apiRouter } from "./routes";

/**
 * Applicazione Express: monta le route e l'adapter degli errori.
 * Non contiene logica di business, solo infrastruttura HTTP.
 */
export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");

  // Origin consentite da env (CSV), mai aperto a tutte le origini
  const allowedOrigins = (process.env.ALLOWED_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json({ limit: "1mb" }));

  // Health check per Render (il Web Service fa polling su /health)
  app.get("/health", (_req, res) => {
    res.status(200).type("text/plain").send("OK");
  });

  // Tutte le route /api richiedono un JWT Supabase valido
  app.use("/api", requireAuth, apiRouter());

  // Rotta sconosciuta → stesso adapter degli errori
  app.use((req, _res, next) => {
    next(
      new HttpError(
        404,
        "ROUTE_NOT_FOUND",
        `Rotta ${req.method} ${req.originalUrl} non trovata`,
      ),
    );
  });

  // Adapter centralizzato: errori zod, Prisma, JSON malformato, 5xx
  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    const { status, body } = toErrorResponse(error);
    if (status >= 500) {
      console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, error);
    }
    if (res.headersSent) {
      res.end();
      return;
    }
    res.status(status).json(body);
  });

  return app;
}
