import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  DayOfWeek,
  Exercise,
  WorkoutDay,
  WorkoutPlan,
  WorkoutSession,
} from "@/types";
import { api } from "./api";
import { MOCK_EXERCISE_LIBRARY, WEEKDAYS } from "./mock-data";

/**
 * Righe dell'API per la scheda (snake_case, come il DB) e conversione
 * verso i tipi dell'app: è l'unico posto che conosce entrambe le forme,
 * le schermate lavorano solo con i tipi di `@/types`.
 */
export interface ApiWorkoutPlan {
  id: string;
  user_id: string;
  name: string;
  source: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiExercise {
  id: string;
  workout_day_id: string;
  name: string;
  sets: number;
  reps: number;
  weight_kg: number | null;
  rest_seconds: number | null;
  order_index: number;
  notes: string | null;
}

export interface ApiWorkoutDay {
  id: string;
  workout_plan_id: string;
  name: string;
  day_order: number;
  created_at: string;
}

/** Risposta di GET /workout-plans/:id: giorni ed esercizi annidati. */
export interface ApiWorkoutPlanDetail extends ApiWorkoutPlan {
  workout_days: (ApiWorkoutDay & { exercises: ApiExercise[] })[];
}

export interface ApiWorkoutSession {
  id: string;
  user_id: string;
  workout_plan_id: string | null;
  workout_day_id: string | null;
  started_at: string;
  completed_at: string | null;
  performed_data: unknown;
  notes: string | null;
}

/* ------------------------------ Conversioni ------------------------------ */

/**
 * Convenzione giorno ↔ settimana: il backend ordina i giorni con
 * `day_order` (non conosce i giorni della settimana), quindi il client
 * usa 1 = lunedì … 7 = domenica. È la stessa numerazione che viene
 * inviata in scrittura.
 */
export function weekdayToDayOrder(weekday: DayOfWeek): number {
  return WEEKDAYS.indexOf(weekday) + 1;
}

/** Valori fuori intervallo (dati anomali) degradano sul primo giorno. */
export function dayOrderToWeekday(dayOrder: number): DayOfWeek {
  const index = Math.min(Math.max(dayOrder, 1), WEEKDAYS.length) - 1;
  return WEEKDAYS[index];
}

/** Gruppi muscolari ricavati dagli esercizi che l'app riconosce. */
function deriveMuscleGroups(exercises: ApiExercise[]): string[] {
  const groups = new Set<string>();
  for (const exercise of exercises) {
    const template = MOCK_EXERCISE_LIBRARY.find(
      (item) => item.name.toLowerCase() === exercise.name.toLowerCase(),
    );
    template?.muscleGroups.forEach((group) => groups.add(group));
  }
  return [...groups];
}

function mapExercise(row: ApiExercise): Exercise {
  return {
    id: row.id,
    dayId: row.workout_day_id,
    name: row.name,
    sets: row.sets,
    reps: row.reps,
    weightKg: row.weight_kg ?? 0,
    order: row.order_index,
  };
}

function mapDay(row: ApiWorkoutDay & { exercises: ApiExercise[] }): WorkoutDay {
  return {
    id: row.id,
    planId: row.workout_plan_id,
    dayOfWeek: dayOrderToWeekday(row.day_order),
    name: row.name,
    muscleGroups: deriveMuscleGroups(row.exercises),
    // Nessuna colonna "riposo" nel DB: un giorno senza esercizi è recupero.
    isRestDay: row.exercises.length === 0,
    exercises: row.exercises.map(mapExercise),
  };
}

function mapPlan(row: ApiWorkoutPlan): WorkoutPlan {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    source: row.source,
    isActive: row.is_active,
    createdAt: row.created_at,
    // La lista non include i giorni: servono dal dettaglio.
    days: [],
  };
}

function mapPlanDetail(row: ApiWorkoutPlanDetail): WorkoutPlan {
  return { ...mapPlan(row), days: row.workout_days.map(mapDay) };
}

/** Solo le sessioni chiuse entrano nello storico (hanno una durata). */
function mapSession(row: ApiWorkoutSession): WorkoutSession | null {
  if (!row.completed_at) return null;
  const durationMinutes = Math.max(
    1,
    Math.round((Date.parse(row.completed_at) - Date.parse(row.started_at)) / 60000),
  );
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.workout_plan_id ?? "",
    dayId: row.workout_day_id ?? "",
    startedAt: row.started_at,
    endedAt: row.completed_at,
    durationMinutes,
    // Nessuna kcal: il backend non le calcola, il badge resta assente.
  };
}

/* -------------------------------- Query ---------------------------------- */

export const workoutKeys = {
  all: ["workout"] as const,
  plans: ["workout", "plans"] as const,
  detail: (planId: string) => ["workout", "detail", planId] as const,
  sessions: ["workout", "sessions"] as const,
};

/** Lista dei piani, più recente in cima (GET /workout-plans). */
export function useWorkoutPlans() {
  return useQuery({
    queryKey: workoutKeys.plans,
    queryFn: () => api.get<ApiWorkoutPlan[]>("/workout-plans"),
    select: (rows) => rows.map(mapPlan),
  });
}

/** Dettaglio con giorni/esercizi annidati; nessun piano → query disattiva. */
export function useWorkoutPlan(planId: string | null | undefined) {
  return useQuery({
    queryKey: workoutKeys.detail(planId ?? "none"),
    queryFn: () => api.get<ApiWorkoutPlanDetail>(`/workout-plans/${planId}`),
    enabled: !!planId,
    select: mapPlanDetail,
  });
}

/** Storico delle sessioni completate (GET /workout-sessions). */
export function useWorkoutSessions() {
  return useQuery({
    queryKey: workoutKeys.sessions,
    queryFn: () => api.get<ApiWorkoutSession[]>("/workout-sessions"),
    select: (rows) =>
      rows.map(mapSession).filter((row): row is WorkoutSession => row !== null),
  });
}

/* ------------------------------- Mutazioni ------------------------------- */

export interface SaveWorkoutDayInput {
  /** Piano esistente; null = primo giorno: il piano viene creato qui. */
  planId: string | null;
  dayOfWeek: DayOfWeek;
  name: string;
  exercises: { name: string; sets: number; reps: number; weightKg: number }[];
}

/**
 * Salva un giorno della settimana: piano (se serve) → sostituzione di un
 * eventuale giorno dello stesso weekday → esercizi in ordine.
 * Restituisce piano e giorno creati, così la schermata sa dove reagire.
 */
export function useSaveWorkoutDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: SaveWorkoutDayInput,
    ): Promise<{ planId: string; dayId: string }> => {
      // 1. Primo giorno di un utente senza piano: lo creiamo qui.
      let planId = input.planId;
      if (!planId) {
        const plan = await api.post<ApiWorkoutPlan>("/workout-plans", {
          name: "La mia scheda",
          source: "manual",
        });
        planId = plan.id;
      }

      // 2. Un giorno per weekday: se ce n'è già uno va sostituito.
      //    (Dal dettaglio in cache, o da una GET al volo se non c'è.)
      const dayOrder = weekdayToDayOrder(input.dayOfWeek);
      const detail =
        queryClient.getQueryData<ApiWorkoutPlanDetail>(workoutKeys.detail(planId)) ??
        (await api.get<ApiWorkoutPlanDetail>(`/workout-plans/${planId}`));
      const existing = detail.workout_days.find((day) => day.day_order === dayOrder);
      if (existing) {
        // Le sessioni collegate sopravvivono: il FK su workout_days è SetNull.
        await api.delete(`/workout-days/${existing.id}`);
      }

      const day = await api.post<ApiWorkoutDay>("/workout-days", {
        workout_plan_id: planId,
        name: input.name,
        day_order: dayOrder,
      });

      // 3. Esercizi in parallelo: l'ordine è esplicito in order_index.
      await Promise.all(
        input.exercises.map((exercise, index) =>
          api.post("/exercises", {
            workout_day_id: day.id,
            name: exercise.name,
            sets: exercise.sets,
            reps: exercise.reps,
            ...(exercise.weightKg > 0 ? { weight_kg: exercise.weightKg } : {}),
            order_index: index + 1,
          }),
        ),
      );

      return { planId, dayId: day.id };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workoutKeys.all }),
  });
}

export interface CreateWorkoutSessionInput {
  planId: string;
  dayId: string;
  startedAt: Date;
  completedAt: Date;
  /** Serie effettivamente svolte: [{exercise_id, sets: [{reps, weight_kg?}]}]. */
  performed: { exercise_id: string; sets: { reps: number; weight_kg?: number }[] }[];
}

/** Registra la sessione chiusa (POST /workout-sessions). */
export function useCreateWorkoutSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateWorkoutSessionInput) =>
      api.post<ApiWorkoutSession>("/workout-sessions", {
        workout_plan_id: input.planId,
        workout_day_id: input.dayId,
        started_at: input.startedAt.toISOString(),
        completed_at: input.completedAt.toISOString(),
        performed_data: input.performed,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workoutKeys.all }),
  });
}

/* --------------------------- Segnale "fatto" ----------------------------- */

/**
 * Indica alla Scheda che una sessione è appena stata salvata, per il
 * banner "Allenamento completato!" (consumato una volta sola).
 */
let completedNotice = false;

export function markWorkoutCompleted(): void {
  completedNotice = true;
}

export function consumeWorkoutCompletedNotice(): boolean {
  const value = completedNotice;
  completedNotice = false;
  return value;
}
