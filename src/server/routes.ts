import { Router } from "express";

/**
 * Route Express = wrapper sottili sugli handler di `src/api`:
 * qui ci sono solo verbo + path + nome dell'handler.
 */
export function apiRouter(): Router {
  const router = Router();

  return router;
}
