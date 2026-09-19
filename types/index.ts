/**
 * Modelli dati di FitTrack.
 * Queste interfacce descrivono la forma dei documenti che verranno
 * salvati su API/backend (o localmente durante lo sviluppo mock).
 */

/** Giorni della settimana, usati da WorkoutDay e Reminder. */
export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface User {
  id: string;
  email: string;
  name: string;
  isPremium: boolean;
  isTrial: boolean;
  trialEndsAt: string | null;
  goal: string | null;
  age: number | null;
  weightKg: number | null;
  heightCm: number | null;
  gender: string | null;
  activityLevel: string | null;
  dailyCalories: number | null;
  acceptedDisclaimer: boolean;
  createdAt: string;
}

export interface WorkoutPlan {
  id: string;
  userId: string;
  name: string;
  source: string;
  days: WorkoutDay[];
  createdAt: string;
}

export interface WorkoutDay {
  id: string;
  planId: string;
  dayOfWeek: DayOfWeek;
  name: string;
  muscleGroups: string[];
  isRestDay: boolean;
  exercises: Exercise[];
}

export interface Exercise {
  id: string;
  dayId: string;
  name: string;
  sets: number;
  reps: number;
  weightKg: number;
  order: number;
}

export interface WorkoutSession {
  id: string;
  userId: string;
  planId: string;
  dayId: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  caloriesBurned: number;
}

export interface DietPlan {
  id: string;
  userId: string;
  name: string;
  source: string;
  meals: Meal[];
  createdAt: string;
}

export interface Meal {
  id: string;
  dietPlanId: string;
  userId: string;
  type: string;
  date: string;
  totalCalories: number;
  foodItems: FoodItem[];
}

export interface FoodItem {
  id: string;
  mealId: string;
  name: string;
  quantityG: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatsG: number;
  source: string;
  barcode: string;
}

export interface BodyMeasurement {
  id: string;
  userId: string;
  weightKg: number;
  waistCm: number;
  chestCm: number;
  armsCm: number;
  hipsCm: number;
  measuredAt: string;
}

export interface ProgressPhoto {
  id: string;
  userId: string;
  photoUrl: string;
  takenAt: string;
}

export interface Reminder {
  id: string;
  userId: string;
  type: string;
  daysOfWeek: DayOfWeek[];
  time: string;
  message: string;
  isActive: boolean;
}

export interface AiUsageLog {
  id: string;
  userId: string;
  actionType: string;
  usedOn: string;
  count: number;
}

/** Esercizio predefinito riusabile (libreria) per creazione manuale / generazione AI. */
export interface ExerciseTemplate {
  id: string;
  name: string;
  muscleGroups: string[];
  /** Attrezzatura necessaria (chiavi di WORKOUT_EQUIPMENT_OPTIONS). */
  equipment: string[];
  sets: number;
  reps: number;
  weightKg: number;
}

/** Input per la generazione AI di una scheda (mock → API future). */
export interface WorkoutGenerationInput {
  goal: string;
  level: string;
  daysPerWeek: number;
  equipment: string[];
}

/** Giorno di una bozza di scheda (generazione AI / importazione file). */
export interface WorkoutDraftDay {
  id: string;
  name: string;
  muscleGroups: string[];
  exercises: ExerciseTemplate[];
}

/** Bozza di scheda generata o importata, mostrata prima del salvataggio. */
export interface WorkoutDraft {
  id: string;
  name: string;
  days: WorkoutDraftDay[];
}