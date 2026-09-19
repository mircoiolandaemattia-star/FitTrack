import type {
  DayOfWeek,
  DietPlan,
  FoodItem,
  Meal,
  WorkoutDay,
  WorkoutPlan,
  WorkoutSession,
} from "@/types";

/**
 * Dati mock per la schermata Home.
 * Struttura già pronta per essere sostituita dalle chiamate API reali:
 * manteniamo la stessa forma dei tipi in types/index.ts.
 */

export const MOCK_CALORIE_TARGET = 2200;
export const MOCK_CALORIES_CONSUMED = 1450;

/** Mapping giorno JS (0 = domenica … 6 = sabato) → DayOfWeek. */
const DAY_OF_WEEK: Record<number, DayOfWeek> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

const exercise = (
  id: string,
  dayId: string,
  name: string,
  sets: number,
  reps: number,
  weightKg: number,
  order: number,
) => ({ id, dayId, name, sets, reps, weightKg, order });

/** Piano settimanale Push/Pull/Legs con due giorni di riposo. */
export const mockWorkoutPlan: WorkoutPlan = {
  id: "plan-mock-1",
  userId: "mock-user-1",
  name: "Push / Pull / Legs",
  source: "mock",
  createdAt: "2026-09-14T09:00:00.000Z",
  days: [
    {
      id: "day-push-1",
      planId: "plan-mock-1",
      dayOfWeek: "monday",
      name: "Giorno Push",
      muscleGroups: ["Petto", "Spalle", "Tricipiti"],
      isRestDay: false,
      exercises: [
        exercise("ex-p1", "day-push-1", "Panca piana", 4, 8, 60, 1),
        exercise("ex-p2", "day-push-1", "Panca inclinata manubri", 3, 10, 24, 2),
        exercise("ex-p3", "day-push-1", "Shoulder press", 4, 8, 40, 3),
        exercise("ex-p4", "day-push-1", "Alzate laterali", 3, 12, 10, 4),
        exercise("ex-p5", "day-push-1", "French press", 3, 10, 20, 5),
      ],
    },
    {
      id: "day-pull-1",
      planId: "plan-mock-1",
      dayOfWeek: "tuesday",
      name: "Giorno Pull",
      muscleGroups: ["Schiena", "Bicipiti"],
      isRestDay: false,
      exercises: [
        exercise("ex-pu1", "day-pull-1", "Rematore bilanciere", 4, 8, 60, 1),
        exercise("ex-pu2", "day-pull-1", "Lat machine", 4, 10, 55, 2),
        exercise("ex-pu3", "day-pull-1", "Trazioni assistite", 3, 8, 0, 3),
        exercise("ex-pu4", "day-pull-1", "Curl bilanciere", 3, 10, 25, 4),
        exercise("ex-pu5", "day-pull-1", "Curl martello", 3, 12, 12, 5),
      ],
    },
    {
      id: "day-legs-1",
      planId: "plan-mock-1",
      dayOfWeek: "wednesday",
      name: "Giorno Gambe",
      muscleGroups: ["Quadricipiti", "Femorali", "Polpacci"],
      isRestDay: false,
      exercises: [
        exercise("ex-l1", "day-legs-1", "Squat", 4, 8, 70, 1),
        exercise("ex-l2", "day-legs-1", "Stacco rumeno", 4, 10, 65, 2),
        exercise("ex-l3", "day-legs-1", "Leg press", 4, 12, 120, 3),
        exercise("ex-l4", "day-legs-1", "Affondi", 3, 10, 16, 4),
        exercise("ex-l5", "day-legs-1", "Calf raises", 4, 15, 50, 5),
      ],
    },
    {
      id: "day-rest-1",
      planId: "plan-mock-1",
      dayOfWeek: "thursday",
      name: "Riposo",
      muscleGroups: [],
      isRestDay: true,
      exercises: [],
    },
    {
      id: "day-push-2",
      planId: "plan-mock-1",
      dayOfWeek: "friday",
      name: "Giorno Push",
      muscleGroups: ["Petto", "Spalle", "Tricipiti"],
      isRestDay: false,
      exercises: [
        exercise("ex-p6", "day-push-2", "Panca piana", 4, 8, 62, 1),
        exercise("ex-p7", "day-push-2", "Dip alle parallele", 3, 10, 0, 2),
        exercise("ex-p8", "day-push-2", "Shoulder press", 4, 8, 42, 3),
        exercise("ex-p9", "day-push-2", "Push down", 3, 12, 25, 4),
      ],
    },
    {
      id: "day-pull-2",
      planId: "plan-mock-1",
      dayOfWeek: "saturday",
      name: "Giorno Pull",
      muscleGroups: ["Schiena", "Bicipiti"],
      isRestDay: false,
      exercises: [
        exercise("ex-pu6", "day-pull-2", "Trazioni", 4, 8, 0, 1),
        exercise("ex-pu7", "day-pull-2", "Rematore manubri", 4, 10, 28, 2),
        exercise("ex-pu8", "day-pull-2", "Low row cavo", 3, 12, 60, 3),
        exercise("ex-pu9", "day-pull-2", "Curl concentrato", 3, 10, 12, 4),
      ],
    },
    {
      id: "day-rest-2",
      planId: "plan-mock-1",
      dayOfWeek: "sunday",
      name: "Riposo",
      muscleGroups: [],
      isRestDay: true,
      exercises: [],
    },
  ],
};

/**
 * Restituisce il giorno di scheda programmato per la data indicata
 * (null se il piano non copre quel giorno).
 */
export function getTodayWorkoutDay(date: Date = new Date()): WorkoutDay | null {
  const key = DAY_OF_WEEK[date.getDay()];
  return mockWorkoutPlan.days.find((day) => day.dayOfWeek === key) ?? null;
}

const foodItem = (
  id: string,
  mealId: string,
  name: string,
  quantityG: number,
  calories: number,
  proteinG: number,
  carbsG: number,
  fatsG: number,
  source = "USDA",
): FoodItem => ({ id, mealId, name, quantityG, calories, proteinG, carbsG, fatsG, source, barcode: "" });

const meal = (
  id: string,
  type: string,
  date: string,
  items: FoodItem[],
): Meal => ({
  id,
  dietPlanId: "diet-mock-1",
  userId: "mock-user-1",
  type,
  date,
  totalCalories: items.reduce((sum, item) => sum + item.calories, 0),
  foodItems: items,
});

/** Pasti di oggi, coerenti con MOCK_CALORIES_CONSUMED (1450 kcal). */
export function getTodayMeals(): Meal[] {
  const date = new Date().toISOString().slice(0, 10);
  return [
    meal("meal-colazione", "Colazione", date, [
      foodItem("fi-1", "meal-colazione", "Porridge d'avena", 250, 280, 12, 45, 6),
      foodItem("fi-2", "meal-colazione", "Banana", 120, 100, 1, 26, 0),
    ]),
    meal("meal-pranzo", "Pranzo", date, [
      foodItem("fi-3", "meal-pranzo", "Petto di pollo", 180, 300, 56, 0, 7),
      foodItem("fi-4", "meal-pranzo", "Riso basmati", 200, 220, 4, 48, 1),
    ]),
    meal("meal-cena", "Cena", date, [
      foodItem("fi-5", "meal-cena", "Salmone al forno", 160, 320, 33, 0, 20),
      foodItem("fi-6", "meal-cena", "Verdure miste", 200, 130, 6, 20, 4),
    ]),
    meal("meal-snack", "Snack", date, [
      foodItem("fi-7", "meal-snack", "Yogurt greco", 150, 130, 11, 8, 5),
    ]),
  ];
}

export const mockDietPlan: DietPlan = {
  id: "diet-mock-1",
  userId: "mock-user-1",
  name: "Piano bilanciato 2200 kcal",
  source: "mock",
  createdAt: "2026-09-14T09:00:00.000Z",
  meals: getTodayMeals(),
};

/** Storico sessioni (calorico, derivato) per le statistiche rapide. */
const mockSessions: WorkoutSession[] = [
  { id: "s-1", userId: "mock-user-1", planId: "plan-mock-1", dayId: "day-push-1", startedAt: "2026-09-14T18:00:00.000Z", endedAt: "2026-09-14T18:50:00.000Z", durationMinutes: 50, caloriesBurned: 420 },
  { id: "s-2", userId: "mock-user-1", planId: "plan-mock-1", dayId: "day-pull-1", startedAt: "2026-09-15T18:00:00.000Z", endedAt: "2026-09-15T18:45:00.000Z", durationMinutes: 45, caloriesBurned: 380 },
  { id: "s-3", userId: "mock-user-1", planId: "plan-mock-1", dayId: "day-legs-1", startedAt: "2026-09-16T18:00:00.000Z", endedAt: "2026-09-16T19:00:00.000Z", durationMinutes: 60, caloriesBurned: 520 },
  { id: "s-4", userId: "mock-user-1", planId: "plan-mock-1", dayId: "day-push-2", startedAt: "2026-09-18T18:00:00.000Z", endedAt: "2026-09-18T18:40:00.000Z", durationMinutes: 40, caloriesBurned: 360 },
];

export type QuickStats = {
  streakDays: number;
  weeklyHours: number;
  totalSessions: number;
};

/** Statistiche rapide: streak, ore settimanali e sessioni totali. */
export function getQuickStats(): QuickStats {
  const totalMinutes = mockSessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const weeklyHours = Math.round((totalMinutes / 60) * 10) / 10;
  return {
    streakDays: 6,
    weeklyHours,
    totalSessions: mockSessions.length,
  };
}