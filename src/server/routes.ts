import { Router } from "express";
import * as users from "../api/users";
import * as workoutDays from "../api/workoutDays";
import * as workoutPlans from "../api/workoutPlans";
import { wrap } from "./wrap";

/**
 * Route Express = wrapper sottili sugli handler di `src/api`:
 * qui ci sono solo verbo + path + nome dell'handler.
 */
export function apiRouter(): Router {
  const router = Router();

  // Profilo: niente `:id` (una riga per utente, sempre da req.user_id)
  router.post("/users", wrap(users.createUser));
  router.get("/users/me", wrap(users.getMe));
  router.put("/users/me", wrap(users.updateMe));

  router.get("/workout-plans", wrap(workoutPlans.listWorkoutPlans));
  router.post("/workout-plans", wrap(workoutPlans.createWorkoutPlan));
  router.get("/workout-plans/:id", wrap(workoutPlans.getWorkoutPlan));
  router.put("/workout-plans/:id", wrap(workoutPlans.updateWorkoutPlan));
  router.delete("/workout-plans/:id", wrap(workoutPlans.deleteWorkoutPlan));

  router.get("/workout-days", wrap(workoutDays.listWorkoutDays));
  router.post("/workout-days", wrap(workoutDays.createWorkoutDay));
  router.get("/workout-days/:id", wrap(workoutDays.getWorkoutDay));
  router.put("/workout-days/:id", wrap(workoutDays.updateWorkoutDay));
  router.delete("/workout-days/:id", wrap(workoutDays.deleteWorkoutDay));

  return router;
}
