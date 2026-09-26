import { Router } from "express";
import * as workoutPlans from "../api/workoutPlans";
import { wrap } from "./wrap";

/**
 * Route Express = wrapper sottili sugli handler di `src/api`:
 * qui ci sono solo verbo + path + nome dell'handler.
 */
export function apiRouter(): Router {
  const router = Router();

  router.get("/workout-plans", wrap(workoutPlans.listWorkoutPlans));
  router.post("/workout-plans", wrap(workoutPlans.createWorkoutPlan));
  router.get("/workout-plans/:id", wrap(workoutPlans.getWorkoutPlan));
  router.put("/workout-plans/:id", wrap(workoutPlans.updateWorkoutPlan));
  router.delete("/workout-plans/:id", wrap(workoutPlans.deleteWorkoutPlan));

  return router;
}
