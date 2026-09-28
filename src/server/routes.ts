import { Router } from "express";
import * as bodyMeasurements from "../api/bodyMeasurements";
import * as dietPlans from "../api/dietPlans";
import * as exercises from "../api/exercises";
import * as foodItems from "../api/foodItems";
import * as meals from "../api/meals";
import * as progressPhotos from "../api/progressPhotos";
import * as reminders from "../api/reminders";
import * as users from "../api/users";
import * as workoutDays from "../api/workoutDays";
import * as workoutPlans from "../api/workoutPlans";
import * as workoutSessions from "../api/workoutSessions";
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

  router.get("/exercises", wrap(exercises.listExercises));
  router.post("/exercises", wrap(exercises.createExercise));
  router.get("/exercises/:id", wrap(exercises.getExercise));
  router.put("/exercises/:id", wrap(exercises.updateExercise));
  router.delete("/exercises/:id", wrap(exercises.deleteExercise));

  router.get("/workout-sessions", wrap(workoutSessions.listWorkoutSessions));
  router.post("/workout-sessions", wrap(workoutSessions.createWorkoutSession));
  router.get("/workout-sessions/:id", wrap(workoutSessions.getWorkoutSession));
  router.put("/workout-sessions/:id", wrap(workoutSessions.updateWorkoutSession));
  router.delete("/workout-sessions/:id", wrap(workoutSessions.deleteWorkoutSession));

  router.get("/diet-plans", wrap(dietPlans.listDietPlans));
  router.post("/diet-plans", wrap(dietPlans.createDietPlan));
  router.get("/diet-plans/:id", wrap(dietPlans.getDietPlan));
  router.put("/diet-plans/:id", wrap(dietPlans.updateDietPlan));
  router.delete("/diet-plans/:id", wrap(dietPlans.deleteDietPlan));

  router.get("/meals", wrap(meals.listMeals));
  router.post("/meals", wrap(meals.createMeal));
  router.get("/meals/:id", wrap(meals.getMeal));
  router.put("/meals/:id", wrap(meals.updateMeal));
  router.delete("/meals/:id", wrap(meals.deleteMeal));

  router.get("/food-items", wrap(foodItems.listFoodItems));
  router.post("/food-items", wrap(foodItems.createFoodItem));
  router.get("/food-items/:id", wrap(foodItems.getFoodItem));
  router.put("/food-items/:id", wrap(foodItems.updateFoodItem));
  router.delete("/food-items/:id", wrap(foodItems.deleteFoodItem));

  router.get("/body-measurements", wrap(bodyMeasurements.listBodyMeasurements));
  router.post("/body-measurements", wrap(bodyMeasurements.createBodyMeasurement));
  router.get("/body-measurements/:id", wrap(bodyMeasurements.getBodyMeasurement));
  router.put("/body-measurements/:id", wrap(bodyMeasurements.updateBodyMeasurement));
  router.delete("/body-measurements/:id", wrap(bodyMeasurements.deleteBodyMeasurement));

  // Solo lista + POST + DELETE: niente GET/PUT by `:id`
  router.get("/progress-photos", wrap(progressPhotos.listProgressPhotos));
  router.post("/progress-photos", wrap(progressPhotos.createProgressPhoto));
  router.delete("/progress-photos/:id", wrap(progressPhotos.deleteProgressPhoto));

  router.get("/reminders", wrap(reminders.listReminders));
  router.post("/reminders", wrap(reminders.createReminder));
  router.get("/reminders/:id", wrap(reminders.getReminder));
  router.put("/reminders/:id", wrap(reminders.updateReminder));
  router.delete("/reminders/:id", wrap(reminders.deleteReminder));

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
