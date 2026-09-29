import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "./api";
import { useFoodQueries, useMealsInRange } from "./dietQueries";
import type { ProgressPhoto, WorkoutSession } from "@/types";

/**
 * Progressi su backend reale (body_measurements, progress_photos) con
 * aggregazione lato client dei dati già collegati:
 * - misurazioni/foto: `GET /body-measurements|progress-photos?from=&to=`
 *   con filtro periodo → i parametri query cambiano con la selezione;
 * - statistiche allenamento: derivate da `GET /workout-sessions` (già
 *   usato da Scheda): nessun nuovo endpoint;
 * - grafico calorie: totali giornalieri dai meals/food_items del periodo
 *   (una query alimenti per pasto del periodo, come nel diario).
 * L'upload delle foto resta uno stub: richiede Supabase Storage.
 */

/* --------------------------------- Periodo --------------------------------- */

export type Period = "week" | "month" | "3months";

export const PERIOD_LABELS: Record<Period, string> = {
  week: "Settimana",
  month: "Mese",
  "3months": "3 Mesi",
};

/** Giorni inclusi oltre a oggi (week = 7 giorni totali, ecc.). */
const PERIOD_DAYS: Record<Period, number> = {
  week: 6,
  month: 29,
  "3months": 89,
};

/** Data locale → `YYYY-MM-DD` (l'app lavora sul giorno dell'utente). */
export function toISODate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Intervallo `[from, to]` (compreso) del periodo, in date locali. */
export function periodRange(period: Period): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - PERIOD_DAYS[period]);
  return { from: toISODate(from), to: toISODate(today) };
}

function fmtShort(dateISO: string): string {
  // Mezzanotte locale: la data è solo un calendario, non un istante.
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(
    new Date(`${dateISO}T12:00:00`),
  );
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/* --------------------------------- Tipi API -------------------------------- */

/** Riga `body_measurements` (le circonferenze sono nullable). */
export interface ApiBodyMeasurement {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  chest_cm: number | null;
  arms_cm: number | null;
  created_at: string;
}

/** Riga `progress_photos`. */
export interface ApiProgressPhoto {
  id: string;
  user_id: string;
  date: string;
  photo_url: string;
  created_at: string;
}

/* ------------------------------- Query keys -------------------------------- */

export const progressKeys = {
  measurements: (from: string, to: string) =>
    ["progress", "measurements", from, to] as const,
  /** Prefisso per invalidare tutte le misurazioni (qualunque periodo). */
  measurementsAll: ["progress", "measurements"] as const,
  photos: (from: string, to: string) => ["progress", "photos", from, to] as const,
};

/** Gli errori HTTP 4xx sono risposte, non intoppi: mai in retry. */
function noRetry(failureCount: number, error: unknown): boolean {
  return isApiError(error) ? error.status >= 500 && failureCount < 1 : failureCount < 2;
}

/* --------------------------------- Queries --------------------------------- */

/** Misurazioni del periodo, ordinate per data decrescente (dal backend). */
export function useBodyMeasurements(from: string, to: string) {
  return useQuery({
    queryKey: progressKeys.measurements(from, to),
    queryFn: () =>
      api.get<ApiBodyMeasurement[]>(`/body-measurements?from=${from}&to=${to}`),
    retry: noRetry,
  });
}

function toProgressPhoto(row: ApiProgressPhoto): ProgressPhoto {
  return {
    id: row.id,
    userId: row.user_id,
    photoUrl: row.photo_url,
    takenAt: row.date,
  };
}

/** Foto del periodo, mappate sul modello `ProgressPhoto` dell'app. */
export function useProgressPhotos(from: string, to: string) {
  return useQuery({
    queryKey: progressKeys.photos(from, to),
    queryFn: () => api.get<ApiProgressPhoto[]>(`/progress-photos?from=${from}&to=${to}`),
    select: (rows): ProgressPhoto[] => rows.map(toProgressPhoto),
    retry: noRetry,
  });
}

/* ----------------------------- Serie derivate ------------------------------ */

export type WeightPoint = { date: string; label: string; weight: number };

export type WeightSeries = {
  /** Misurazioni del periodo (date desc), per la lista delle differenze. */
  measurements: ApiBodyMeasurement[];
  points: WeightPoint[]; // in ordine cronologico, solo pesi compilati
  current: number;
  delta: number;
  goalOk: boolean;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
};

/** Serie del grafico peso + misurazioni grezze da un unico `useQuery`. */
export function useWeightSeries(from: string, to: string): WeightSeries {
  const query = useBodyMeasurements(from, to);
  const measurements = query.data ?? [];

  const points: WeightPoint[] = measurements
    .filter((row) => row.weight_kg != null)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({
      date: row.date,
      label: fmtShort(row.date),
      weight: row.weight_kg as number,
    }));

  const first = points[0];
  const last = points[points.length - 1];
  const current = last?.weight ?? 0;
  const delta = last && first ? round1(last.weight - first.weight) : 0;

  return {
    measurements,
    points,
    current,
    delta,
    goalOk: delta < 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: () => void query.refetch(),
  };
}

export type CaloriePoint = { date: string; label: string; calories: number };

export type CalorieSeries = {
  days: CaloriePoint[]; // solo giorni con almeno un pasto registrato
  average: number;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
};

/**
 * Totali calorici giornalieri del periodo: pasti con `GET /meals?from&to`
 * più gli alimenti di ciascun pasto. I giorni senza dati non compaiono
 * (la media è sui giorni registrati, non diluita dagli zeri).
 */
export function useCalorieSeries(from: string, to: string): CalorieSeries {
  const mealsQuery = useMealsInRange(from, to);
  const foodResults = useFoodQueries(mealsQuery.data);

  const perDate = new Map<string, number>();
  (mealsQuery.data ?? []).forEach((meal, index) => {
    const items = foodResults[index]?.data ?? [];
    const calories = items.reduce((sum, item) => sum + item.calories, 0);
    if (calories > 0) {
      perDate.set(meal.date, (perDate.get(meal.date) ?? 0) + calories);
    }
  });

  const days: CaloriePoint[] = [...perDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, calories]) => ({ date, label: fmtShort(date), calories }));

  const average = days.length
    ? Math.round(days.reduce((sum, day) => sum + day.calories, 0) / days.length)
    : 0;

  const firstError =
    mealsQuery.error ?? foodResults.find((result) => result.error)?.error ?? null;

  return {
    days,
    average,
    isLoading: mealsQuery.isLoading || foodResults.some((result) => result.isLoading),
    isError: mealsQuery.isError || foodResults.some((result) => result.isError),
    error: firstError,
    refetch: () => {
      void mealsQuery.refetch();
      foodResults.forEach((result) => void result.refetch());
    },
  };
}

/* --------------------------- Statistiche allenamento ----------------------- */

export type WorkoutStats = {
  streakDays: number;
  sessions: number;
  hours: number;
};

/**
 * Streak = giorni consecutivi con almeno una sessione. Il conteggio parte
 * da oggi, o da ieri se oggi non si è ancora allenati (la giornata è in
 * corso); se l'ultimo allenamento è più vecchio, la streak è 0.
 */
function computeStreak(sessions: WorkoutSession[]): number {
  const days = new Set(sessions.map((s) => toISODate(new Date(s.startedAt))));
  const cursor = new Date();
  if (!days.has(toISODate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (days.has(toISODate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Statistiche del periodo dai dati già disponibili (nessun endpoint nuovo):
 * `GET /workout-sessions` condiviso con Scheda. Le sessioni contate sono
 * solo quelle concluse (il mapper le filtra e ne ha già la durata in
 * `durationMinutes`); streak su `startedAt` dentro l'intervallo, ore sul
 * complesso delle sessioni del periodo, streak invece indipendente dal
 * periodo selezionato.
 */
export function deriveWorkoutStats(
  sessions: WorkoutSession[],
  from: string,
  to: string,
): WorkoutStats {
  const startMs = new Date(`${from}T00:00:00`).getTime();
  const endMs = new Date(`${to}T23:59:59.999`).getTime();

  const inPeriod = sessions.filter((session) => {
    const started = Date.parse(session.startedAt);
    return started >= startMs && started <= endMs;
  });

  const minutes = inPeriod.reduce((sum, session) => sum + session.durationMinutes, 0);

  return {
    streakDays: computeStreak(sessions),
    sessions: inPeriod.length,
    hours: round1(minutes / 60),
  };
}

/* ------------------------- Differenze misurazioni --------------------------- */

export type MeasurementDiff = {
  key: string;
  current: number;
  /** null: prima misurazione di questa circonferenza. */
  diff: number | null;
};

/**
 * Differenze fra l'ultima e la penultima misurazione del periodo (già in
 * ordine decrescente). Le circonferenze non compilate non compaiono.
 */
export function measurementDiffs(measurements: ApiBodyMeasurement[]): MeasurementDiff[] {
  const [current, previous] = measurements;
  if (!current) return [];

  const rows = [
    { key: "Vita", value: current.waist_cm, prev: previous?.waist_cm },
    { key: "Fianchi", value: current.hips_cm, prev: previous?.hips_cm },
    { key: "Petto", value: current.chest_cm, prev: previous?.chest_cm },
    { key: "Braccia", value: current.arms_cm, prev: previous?.arms_cm },
  ];

  return rows
    .filter((row) => row.value != null)
    .map((row) => ({
      key: row.key,
      current: round1(row.value as number),
      diff: row.prev != null ? round1((row.value as number) - row.prev) : null,
    }));
}

/* -------------------------------- Mutation --------------------------------- */

export type AddMeasurementInput = {
  date: string;
  weight_kg: number;
  waist_cm?: number;
  hips_cm?: number;
  chest_cm?: number;
  arms_cm?: number;
};

/** `POST /api/body-measurements`: pesa almeno il peso, le circonferenze no. */
export function useAddMeasurement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddMeasurementInput) =>
      api.post<ApiBodyMeasurement>("/body-measurements", {
        date: input.date,
        weight_kg: input.weight_kg,
        ...(input.waist_cm != null ? { waist_cm: input.waist_cm } : {}),
        ...(input.hips_cm != null ? { hips_cm: input.hips_cm } : {}),
        ...(input.chest_cm != null ? { chest_cm: input.chest_cm } : {}),
        ...(input.arms_cm != null ? { arms_cm: input.arms_cm } : {}),
      }),
    onSuccess: () => {
      // Le serie sono per intervallo: invalida ogni periodo.
      void queryClient.invalidateQueries({ queryKey: progressKeys.measurementsAll });
    },
  });
}
