import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "./api";
import { type ApiMealType } from "./dietQueries";
import { workoutKeys } from "./workoutQueries";

/**
 * Funzioni AI collegate al backend (`POST /api/ai/*`).
 *
 * Tutte e quattro le route sono usate dall'app:
 * - `meal-photo`   → Dieta, foto pasto (free 2/giorno, premium illimitato);
 * - `diet-generate`→ Dieta, "Genera dieta con AI" (premium);
 * - `workout-generate` → Scheda, "Genera con AI" (premium, salva il piano);
 * - `file-read`    → Dieta e Scheda, importazione di un file esistente
 *                    (premium, restituisce una bozza da confermare).
 *
 * La `GEMINI_API_KEY` vive solo sul server: qui passa soltanto il contenuto
 * (foto/file base64 + testo). Errori e limiti arrivano già in italiano
 * (`PREMIUM_REQUIRED`, `DAILY_LIMIT_REACHED`, `GEMINI_*`).
 */

/** L'analisi AI può impiegare diversi secondi: timeout dedicato (default60s). */
const AI_TIMEOUT_MS = 120_000;

/** Riga di stima di `POST /ai/meal-photo`: gli stessi campi di `food_items`. */
export interface AiFoodItem {
  name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MealPhotoResult {
  items: AiFoodItem[];
  /** Osservazioni del modello (es. "porzione stimata"), opzionale. */
  notes: string | null;
  /** Analisi rimaste oggi al piano free; `null` = premium, illimitato. */
  remaining_today: number | null;
}

export type AnalyzeMealPhotoInput = {
  /** Immagine base64 **senza** prefisso `data:...;base64,`. */
  photo: string;
  mimeType: string;
  /** Descrizione libera: cosa ha mangiato l'utente. */
  description: string;
};

/** Gli errori 4xx sono risposte, non intoppi: mai in retry. */
function noRetry(failureCount: number, error: unknown): boolean {
  return isApiError(error) ? error.status >= 500 && failureCount < 1 : failureCount < 2;
}

/** Analisi di una foto pasto → bozza di alimenti da confermare. */
export function useAnalyzeMealPhoto() {
  return useMutation({
    mutationFn: ({ photo, mimeType, description }: AnalyzeMealPhotoInput) =>
      api.post<MealPhotoResult>("/ai/meal-photo", {
        photo,
        mime_type: mimeType,
        description,
      }, { timeoutMs: AI_TIMEOUT_MS }),
    retry: noRetry,
  });
}

/* ------------------------- Generazione dieta (premium) --------------------- */

/** Pasto annidato della risposta di `POST /ai/diet-generate` (già salvato). */
export interface AiGeneratedMeal {
  id: string;
  meal_type: ApiMealType;
  name: string | null;
  date: string;
  food_items: AiFoodItem[];
}

export interface AiGeneratedDietPlan {
  id: string;
  name: string;
  daily_calorie_target: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  meals: AiGeneratedMeal[];
}

export interface GenerateDietInput {
  goal: string;
  dietType: string;
  mealsPerDay: number;
  allergies: string[];
  notes?: string;
}

/**
 * Genera e salva un nuovo `diet_plans` (`source: "ai"`) con pasti ed
 * alimenti annidati. I pasti nascono datati oggi: oltre ai piani va
 * invalidato anche il diario, altrimenti il giorno non li mostra.
 */
export function useGenerateDiet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateDietInput) =>
      api.post<AiGeneratedDietPlan>("/ai/diet-generate", {
        goal: input.goal,
        diet_type: input.dietType,
        meals_per_day: input.mealsPerDay,
        allergies: input.allergies,
        notes: input.notes ?? "",
      }, { timeoutMs: AI_TIMEOUT_MS }),
    retry: noRetry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["diet"] }),
  });
}

/* ----------------------- Generazione scheda (premium) ---------------------- */

/** Esercizio annidato della risposta di `POST /ai/workout-generate`. */
export interface AiGeneratedExercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight_kg: number | null;
  rest_seconds: number | null;
  notes: string | null;
  order_index: number;
}

/** Giorno annidato: il piano è già salvato dal backend. */
export interface AiGeneratedDay {
  id: string;
  name: string;
  day_order: number;
  exercises: AiGeneratedExercise[];
}

export interface AiGeneratedWorkoutPlan {
  id: string;
  name: string;
  source: string;
  workout_days: AiGeneratedDay[];
}

export interface GenerateWorkoutInput {
  goal: string;
  level: string;
  daysPerWeek: number;
  equipment: string[];
  notes?: string;
}

/**
 * Genera e salva un nuovo `workout_plans` (`source: "ai"`) con giorni ed
 * esercizi annidati: la scheda è visibile appena la chiamata risponde.
 */
export function useGenerateWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateWorkoutInput) =>
      api.post<AiGeneratedWorkoutPlan>("/ai/workout-generate", {
        goal: input.goal,
        level: input.level,
        days_per_week: input.daysPerWeek,
        equipment: input.equipment,
        notes: input.notes ?? "",
      }, { timeoutMs: AI_TIMEOUT_MS }),
    retry: noRetry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workoutKeys.all }),
  });
}

/* --------------------------- Lettura file (premium) ------------------------ */

/** Esercizio estratto da un file (stessa forma di `exercises`, senza id). */
export interface AiFileExercise {
  name: string;
  sets: number;
  reps: number;
  weight_kg: number | null;
  rest_seconds: number | null;
  notes: string | null;
}

export interface AiFileWorkout {
  name: string;
  days: { name: string; exercises: AiFileExercise[] }[];
}

export interface AiFileMeal {
  meal_type: ApiMealType;
  name: string | null;
  foods: AiFoodItem[];
}

export interface AiFileDiet {
  name: string;
  daily_calorie_target: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  meals: AiFileMeal[];
}

/** Risposta di `POST /ai/file-read`: nessun salvataggio, solo bozza. */
export type AiFileReadResult =
  | { kind: "workout"; workout: AiFileWorkout; notes?: string | null }
  | { kind: "diet"; diet: AiFileDiet; notes?: string | null };

export interface ReadFileInput {
  /** File base64 (con o senza prefisso `data:...;base64,`). */
  file: string;
  mimeType: string;
  /** "auto" lascia decidere al modello se è una scheda o una dieta. */
  kind: "auto" | "workout" | "diet";
}

/** Legge un documento esistente: la bozza va controllata prima di salvare. */
export function useReadFile() {
  return useMutation({
    mutationFn: ({ file, mimeType, kind }: ReadFileInput) =>
      api.post<AiFileReadResult>("/ai/file-read", {
        file,
        mime_type: mimeType,
        kind,
      }, { timeoutMs: AI_TIMEOUT_MS }),
    retry: noRetry,
  });
}

/* -------------------------------- Errori ----------------------------------- */

/**
 * Messaggio leggibile per un errore delle funzioni AI: l'API restituisce
 * testo italiano già pronto (`DAILY_LIMIT_REACHED`, `PREMIUM_REQUIRED`,
 * `GEMINI_*`), qui si copre solo il caso di rete assente.
 */
export function aiErrorMessage(error: unknown): string {
  if (isApiError(error)) return error.message;
  return "Connessione al server non riuscita: riprova.";
}
