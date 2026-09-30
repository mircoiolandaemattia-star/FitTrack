import { z } from "zod";

/**
 * Strutture che Gemini deve restituire ai quattro endpoint `/api/ai/*`.
 *
 * Sono **gli stessi campi** delle tabelle di destinazione (food_items,
 * exercises → workout_days → workout_plans, food_items → meals →
 * diet_plans), così la risposta si salva o si mostra in conferma senza
 * adattamenti. `coerce.number()` accetta anche i numeri scritti come
 * stringa: Gemini a volte produce `"12"` invece di `12` e un rigetto qui
 * diventerebbe un errore 502 a ogni risposta altrimenti corretta.
 */
const float = (max: number, min = 0) => z.coerce.number().min(min).max(max);
const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

/** Riga `food_items` (il frontend la mostra in conferma prima di salvare). */
export const aiFoodItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  quantity_g: float(10000),
  calories: int(0, 10000),
  protein_g: float(1000),
  carbs_g: float(1000),
  fat_g: float(1000),
});
export type AiFoodItem = z.output<typeof aiFoodItemSchema>;

/** Risposta di `POST /api/ai/meal-photo`: solo stime, nessun salvataggio. */
export const aiMealPhotoSchema = z.object({
  items: z.array(aiFoodItemSchema).max(40),
  notes: z.string().max(600).optional(),
});
export type AiMealPhotoResult = z.output<typeof aiMealPhotoSchema>;

/** Riga `exercises`. */
export const aiExerciseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sets: int(1, 30),
  reps: int(1, 300),
  weight_kg: float(1000).nullable().optional(),
  rest_seconds: int(0, 1800).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

/** Riga `workout_days` con gli esercizi annidati. */
export const aiWorkoutDaySchema = z.object({
  name: z.string().trim().min(1).max(120),
  exercises: z.array(aiExerciseSchema).min(1).max(30),
});

/** Piano generato: corrisponde a `workout_plans` + giorni + esercizi. */
export const aiWorkoutPlanSchema = z.object({
  name: z.string().trim().min(1).max(200),
  days: z.array(aiWorkoutDaySchema).min(1).max(7),
});
export type AiWorkoutPlan = z.output<typeof aiWorkoutPlanSchema>;

/** Pasto generato: `meals` con gli alimenti annidati. */
export const aiMealSchema = z.object({
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  name: z.string().trim().max(120).optional(),
  foods: z.array(aiFoodItemSchema).min(1).max(20),
});

/** Dieta generata: corrisponde a `diet_plans` + pasti + alimenti. */
export const aiDietPlanSchema = z.object({
  name: z.string().trim().min(1).max(200),
  daily_calorie_target: int(0, 20000).nullable().optional(),
  protein_g: int(0, 2000).nullable().optional(),
  carbs_g: int(0, 3000).nullable().optional(),
  fat_g: int(0, 1000).nullable().optional(),
  meals: z.array(aiMealSchema).min(1).max(8),
});
export type AiDietPlan = z.output<typeof aiDietPlanSchema>;

/**
 * Risposta di `POST /api/ai/file-read`: la struttura estratta dal file,
 * distinta tra scheda e dieta, restituita per conferma (nessun salvataggio).
 */
export const aiFileReadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("workout"),
    workout: aiWorkoutPlanSchema,
    notes: z.string().max(600).optional(),
  }),
  z.object({
    kind: z.literal("diet"),
    diet: aiDietPlanSchema,
    notes: z.string().max(600).optional(),
  }),
]);
export type AiFileReadResult = z.output<typeof aiFileReadSchema>;
