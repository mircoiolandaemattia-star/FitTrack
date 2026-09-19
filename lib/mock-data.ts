import type {
  DayOfWeek,
  DietPlan,
  ExerciseTemplate,
  FoodItem,
  Meal,
  WorkoutDay,
  WorkoutDraft,
  WorkoutDraftDay,
  WorkoutGenerationInput,
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

/** Storico sessioni iniziale (calorico, derivato) per le statistiche rapide. */
const mockSessions: WorkoutSession[] = [
  { id: "s-1", userId: "mock-user-1", planId: "plan-mock-1", dayId: "day-push-1", startedAt: "2026-09-14T18:00:00.000Z", endedAt: "2026-09-14T18:50:00.000Z", durationMinutes: 50, caloriesBurned: 420 },
  { id: "s-2", userId: "mock-user-1", planId: "plan-mock-1", dayId: "day-pull-1", startedAt: "2026-09-15T18:00:00.000Z", endedAt: "2026-09-15T18:45:00.000Z", durationMinutes: 45, caloriesBurned: 380 },
  { id: "s-3", userId: "mock-user-1", planId: "plan-mock-1", dayId: "day-legs-1", startedAt: "2026-09-16T18:00:00.000Z", endedAt: "2026-09-16T19:00:00.000Z", durationMinutes: 60, caloriesBurned: 520 },
  { id: "s-4", userId: "mock-user-1", planId: "plan-mock-1", dayId: "day-push-2", startedAt: "2026-09-18T18:00:00.000Z", endedAt: "2026-09-18T18:40:00.000Z", durationMinutes: 40, caloriesBurned: 360 },
];

/**
 * Store in-memory delle sessioni: simula le chiamate API che verranno
 * collegate in seguito. Statistiche e storico leggono da qui.
 */
let sessionStore: WorkoutSession[] = [...mockSessions];
let completedNotice = false;

/** Sessioni più recenti in cima. */
export function listSessions(): WorkoutSession[] {
  return [...sessionStore].sort((a, b) => b.endedAt.localeCompare(a.endedAt));
}

/** Salva una sessione completata (mock → POST /workout-sessions in futuro). */
export function addWorkoutSession(input: {
  dayId: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  caloriesBurned: number;
}): WorkoutSession {
  const session: WorkoutSession = {
    id: `s-${Date.now()}`,
    userId: "mock-user-1",
    planId: "plan-mock-1",
    ...input,
  };
  sessionStore = [session, ...sessionStore];
  completedNotice = true;
  return session;
}

/** Consuma (una volta sola) il segnale "allenamento completato!". */
export function consumeWorkoutCompletedNotice(): boolean {
  const value = completedNotice;
  completedNotice = false;
  return value;
}

export type QuickStats = {
  streakDays: number;
  weeklyHours: number;
  totalSessions: number;
};

/** Statistiche rapide: streak, ore settimanali e sessioni totali. */
export function getQuickStats(): QuickStats {
  const totalMinutes = sessionStore.reduce((sum, session) => sum + session.durationMinutes, 0);
  const weeklyHours = Math.round((totalMinutes / 60) * 10) / 10;
  return {
    streakDays: 6,
    weeklyHours,
    totalSessions: sessionStore.length,
  };
}

/* ------------------------------------------------------------------ */
/* Scheda settimanale: ordinamento, etichette e store dei giorni      */
/* ------------------------------------------------------------------ */

/** Restituisce il piano settimanale (mock, mutato in-place dagli upsert). */
export function getWorkoutPlan(): WorkoutPlan {
  return mockWorkoutPlan;
}

/** Ordine canonico della settimana (lunedì → domenica). */
export const WEEKDAYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: "Lunedì",
  tuesday: "Martedì",
  wednesday: "Mercoledì",
  thursday: "Giovedì",
  friday: "Venerdì",
  saturday: "Sabato",
  sunday: "Domenica",
};

const DAY_SHORT_LABELS: Record<DayOfWeek, string> = {
  monday: "Lun",
  tuesday: "Mar",
  wednesday: "Mer",
  thursday: "Gio",
  friday: "Ven",
  saturday: "Sab",
  sunday: "Dom",
};

export function getDayLabel(day: DayOfWeek): string {
  return DAY_LABELS[day];
}

export function getDayShortLabel(day: DayOfWeek): string {
  return DAY_SHORT_LABELS[day];
}

/** DayOfWeek di oggi (mappato da Date.getDay()). */
export function getTodayDayOfWeek(date: Date = new Date()): DayOfWeek {
  return DAY_OF_WEEK[date.getDay()];
}

/** Nome del giorno di scheda a partire dal dayId (per lo storico). */
export function getWorkoutDayName(dayId: string): string {
  const day = mockWorkoutPlan.days.find((d) => d.id === dayId);
  return day ? day.name : "Allenamento";
}

/**
 * Aggiunge o sostituisce un giorno nel piano settimanale (upsert per
 * dayOfWeek). Il piano mock viene mutato in-place: Home e Scheda leggono
 * dallo stesso oggetto.
 */
export function upsertWorkoutDay(input: {
  dayOfWeek: DayOfWeek;
  name: string;
  muscleGroups: string[];
  isRestDay: boolean;
  exercises: { name: string; sets: number; reps: number; weightKg: number }[];
}): WorkoutDay {
  const dayId = `day-${input.dayOfWeek}-${Date.now()}`;
  const day: WorkoutDay = {
    id: dayId,
    planId: "plan-mock-1",
    dayOfWeek: input.dayOfWeek,
    name: input.name,
    muscleGroups: input.muscleGroups,
    isRestDay: input.isRestDay,
    exercises: input.exercises.map((ex, order) => ({
      id: `${dayId}-ex-${order}`,
      dayId,
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      weightKg: ex.weightKg,
      order: order + 1,
    })),
  };
  mockWorkoutPlan.days = [
    ...mockWorkoutPlan.days.filter((d) => d.dayOfWeek !== input.dayOfWeek),
    day,
  ];
  return day;
}

/** Applica una bozza generata/importata: ogni giorno occupa un weekday (dal lunedì). */
export function applyWorkoutDraft(draft: WorkoutDraft): WorkoutDay[] {
  return draft.days.map((day, index) =>
    upsertWorkoutDay({
      dayOfWeek: WEEKDAYS[index % WEEKDAYS.length],
      name: day.name,
      muscleGroups: day.muscleGroups,
      isRestDay: false,
      exercises: day.exercises.map((ex) => ({
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        weightKg: ex.weightKg,
      })),
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Creazione manuale: tipi di allenamento e libreria esercizi         */
/* ------------------------------------------------------------------ */

export type TrainingTypeKey = "push" | "pull" | "legs" | "fullbody" | "rest";

export const TRAINING_TYPES: { key: TrainingTypeKey; label: string; muscleGroups: string[] }[] = [
  { key: "push", label: "Push", muscleGroups: ["Petto", "Spalle", "Tricipiti"] },
  { key: "pull", label: "Pull", muscleGroups: ["Schiena", "Bicipiti"] },
  { key: "legs", label: "Gambe", muscleGroups: ["Quadricipiti", "Femorali", "Polpacci"] },
  { key: "fullbody", label: "Full body", muscleGroups: ["Tutto il corpo"] },
  { key: "rest", label: "Riposo", muscleGroups: [] },
];

/** Attrezzatura selezionabile per la generazione AI. */
export const WORKOUT_EQUIPMENT_OPTIONS: { key: string; label: string }[] = [
  { key: "palestra", label: "Palestra completa" },
  { key: "manubri", label: "Manubri" },
  { key: "bilanciere", label: "Bilanciere" },
  { key: "cavi", label: "Cavi e macchine" },
  { key: "corpo-libero", label: "A corpo libero" },
  { key: "kettlebell", label: "Kettlebell" },
];

export const AI_GOAL_OPTIONS: { key: string; label: string }[] = [
  { key: "ipertrofia", label: "Ipertrofia" },
  { key: "forza", label: "Forza" },
  { key: "resistenza", label: "Resistenza" },
  { key: "dimagrimento", label: "Dimagrimento" },
];

export const AI_LEVEL_OPTIONS: { key: string; label: string }[] = [
  { key: "principiante", label: "Principiante" },
  { key: "intermedio", label: "Intermedio" },
  { key: "avanzato", label: "Avanzato" },
];

const libraryItem = (
  id: string,
  name: string,
  muscleGroups: string[],
  equipment: string[],
  sets: number,
  reps: number,
  weightKg: number,
): ExerciseTemplate => ({ id, name, muscleGroups, equipment, sets, reps, weightKg });

/** Libreria di esercizi predefiniti per creazione manuale e generazione AI. */
export const MOCK_EXERCISE_LIBRARY: ExerciseTemplate[] = [
  libraryItem("lib-panca", "Panca piana", ["Petto"], ["bilanciere"], 4, 8, 60),
  libraryItem("lib-panca-incli", "Panca inclinata manubri", ["Petto"], ["manubri"], 3, 10, 24),
  libraryItem("lib-flessioni", "Flessioni", ["Petto"], ["corpo-libero"], 3, 12, 0),
  libraryItem("lib-shoulder", "Shoulder press", ["Spalle"], ["bilanciere", "manubri"], 4, 8, 40),
  libraryItem("lib-laterali", "Alzate laterali", ["Spalle"], ["manubri"], 3, 12, 10),
  libraryItem("lib-french", "French press", ["Tricipiti"], ["bilanciere"], 3, 10, 20),
  libraryItem("lib-pushdown", "Push down", ["Tricipiti"], ["cavi"], 3, 12, 25),
  libraryItem("lib-dip", "Dip alle parallele", ["Tricipiti"], ["corpo-libero"], 3, 10, 0),
  libraryItem("lib-rem-b", "Rematore bilanciere", ["Schiena"], ["bilanciere"], 4, 8, 60),
  libraryItem("lib-rem-m", "Rematore manubri", ["Schiena"], ["manubri"], 4, 10, 28),
  libraryItem("lib-lat", "Lat machine", ["Schiena"], ["cavi"], 4, 10, 55),
  libraryItem("lib-trazioni", "Trazioni", ["Schiena"], ["corpo-libero", "cavi"], 4, 8, 0),
  libraryItem("lib-lowrow", "Low row cavo", ["Schiena"], ["cavi"], 3, 12, 60),
  libraryItem("lib-curl-b", "Curl bilanciere", ["Bicipiti"], ["bilanciere"], 3, 10, 25),
  libraryItem("lib-curl-m", "Curl martello", ["Bicipiti"], ["manubri"], 3, 12, 12),
  libraryItem("lib-curl-conc", "Curl concentrato", ["Bicipiti"], ["manubri"], 3, 10, 12),
  libraryItem("lib-squat", "Squat", ["Quadricipiti", "Femorali"], ["bilanciere"], 4, 8, 70),
  libraryItem("lib-squat-cb", "Squat a corpo libero", ["Quadricipiti", "Femorali"], ["corpo-libero"], 3, 15, 0),
  libraryItem("lib-stacco", "Stacco rumeno", ["Femorali", "Glutei"], ["bilanciere"], 4, 10, 65),
  libraryItem("lib-legpress", "Leg press", ["Quadricipiti"], ["cavi"], 4, 12, 120),
  libraryItem("lib-affondi", "Affondi", ["Quadricipiti", "Glutei"], ["manubri", "corpo-libero"], 3, 10, 16),
  libraryItem("lib-calf", "Calf raises", ["Polpacci"], ["cavi", "corpo-libero"], 4, 15, 50),
  libraryItem("lib-plank", "Plank", ["Core"], ["corpo-libero"], 3, 45, 0),
  libraryItem("lib-crunch", "Crunch", ["Core"], ["corpo-libero"], 3, 20, 0),
  libraryItem("lib-swing", "Kettlebell swing", ["Core", "Glutei"], ["kettlebell"], 4, 15, 16),
  libraryItem("lib-tgu", "Turkish get-up", ["Core", "Spalle"], ["kettlebell"], 3, 6, 12),
];

/** Esercizi standard per ogni tipo di allenamento (creazione manuale / AI). */
export const TYPE_DEFAULT_EXERCISES: Record<Exclude<TrainingTypeKey, "rest">, string[]> = {
  push: ["lib-panca", "lib-shoulder", "lib-laterali", "lib-french", "lib-pushdown"],
  pull: ["lib-trazioni", "lib-rem-b", "lib-lat", "lib-curl-b", "lib-curl-m"],
  legs: ["lib-squat", "lib-stacco", "lib-legpress", "lib-affondi", "lib-calf"],
  fullbody: ["lib-squat", "lib-panca", "lib-rem-b", "lib-laterali", "lib-plank"],
};

/** Restituisce gli esercizi predefiniti per un tipo (copie della libreria). */
export function getDefaultExercises(type: Exclude<TrainingTypeKey, "rest">): ExerciseTemplate[] {
  return TYPE_DEFAULT_EXERCISES[type]
    .map((id) => MOCK_EXERCISE_LIBRARY.find((item) => item.id === id))
    .filter((item): item is ExerciseTemplate => Boolean(item))
    .map((item) => ({ ...item }));
}

/** Compatibilità esercizio/attrezzatura scelta. */
function isEquipmentCompatible(item: ExerciseTemplate, equipmentKeys: string[]): boolean {
  if (equipmentKeys.includes("palestra")) return true;
  return item.equipment.some((key) => equipmentKeys.includes(key));
}

/** Fallback "a corpo libero" quando l'attrezzatura non copre gli esercizi base. */
const BODYWEIGHT_FALLBACK = ["lib-flessioni", "lib-squat-cb", "lib-plank", "lib-crunch"];

/**
 * Genera una bozza di scheda (mock) a partire dall'input AI.
 * In futuro verrà chiamato l'endpoint /workouts/generate.
 */
export function generateMockWorkout(input: WorkoutGenerationInput): WorkoutDraft {
  const daysPerWeek = Math.max(2, Math.min(6, input.daysPerWeek));
  const cycle: { type: Exclude<TrainingTypeKey, "rest">; name: string }[] = [
    { type: "push", name: "Giorno Push" },
    { type: "pull", name: "Giorno Pull" },
    { type: "legs", name: "Giorno Gambe" },
    { type: "fullbody", name: "Full Body" },
    { type: "push", name: "Giorno Push" },
    { type: "pull", name: "Giorno Pull" },
  ];

  const days: WorkoutDraftDay[] = cycle.slice(0, daysPerWeek).map((slot, index) => {
    const source = getDefaultExercises(slot.type);
    const compatible = source.filter((item) => isEquipmentCompatible(item, input.equipment));
    const pool = compatible.length >= 3 ? compatible : BODYWEIGHT_FALLBACK.map(
      (id) => MOCK_EXERCISE_LIBRARY.find((item) => item.id === id),
    ).filter((item): item is ExerciseTemplate => Boolean(item));

    const exercises = pool.map((item, j) => {
      let sets = item.sets;
      let reps = item.reps;
      let weightKg = item.weightKg;
      if (input.level === "principiante") {
        sets = Math.max(2, sets - 1);
        weightKg = Math.round(weightKg * 0.8);
      }
      if (input.goal === "resistenza" || input.goal === "dimagrimento") {
        reps = Math.min(20, reps + 2);
      }
      return { ...item, id: `ai-${index}-${j}`, sets, reps, weightKg };
    });

    return {
      id: `draft-day-${index}`,
      name: slot.name,
      muscleGroups: TRAINING_TYPES.find((t) => t.key === slot.type)?.muscleGroups ?? [],
      exercises,
    };
  });

  const goalLabel = AI_GOAL_OPTIONS.find((g) => g.key === input.goal)?.label ?? "Scheda";
  return {
    id: `ai-draft-${Date.now()}`,
    name: `${goalLabel} · ${daysPerWeek} giorni`,
    days,
  };
}

/** Bozza mock "estrapolata" da un file caricato (PDF/foto), da collegare all'AI. */
export function buildImportedWorkoutDraft(fileName: string): WorkoutDraft {
  const baseName = fileName.replace(/\.[^.]+$/, "") || "Scheda importata";
  const picks = ["lib-squat", "lib-panca", "lib-rem-b", "lib-curl-b"];
  const exercises = picks
    .map((id, index) => ({ ...MOCK_EXERCISE_LIBRARY.find((item) => item.id === id), id: `imp-${index}` }))
    .filter((item): item is ExerciseTemplate => Boolean(item));
  return {
    id: `import-draft-${Date.now()}`,
    name: baseName,
    days: [
      {
        id: "import-day-1",
        name: "Giorno importato",
        muscleGroups: ["Misto"],
        exercises,
      },
    ],
  };
}