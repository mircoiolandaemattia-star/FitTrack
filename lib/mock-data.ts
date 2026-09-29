import type {
  DayOfWeek,
  ExerciseTemplate,
  WorkoutDraft,
  WorkoutDraftDay,
  WorkoutGenerationInput,
} from "@/types";

/**
 * Utility e dati mock rimasti: etichette dei giorni, libreria esercizi
 * (usata da Scheda/creazione) e generatore AI di bozze. La Home usa dati
 * reali dal backend; `QuickStats` resta il tipo della card statistiche.
 */

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

export type QuickStats = {
  streakDays: number;
  weeklyHours: number;
  totalSessions: number;
};

/* ------------------------------------------------------------------ */
/* Scheda settimanale: ordinamento, etichette e store dei giorni      */
/* ------------------------------------------------------------------ */

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