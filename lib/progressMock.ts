import type { BodyMeasurement, ProgressPhoto } from "@/types";
import { MOCK_CALORIE_TARGET } from "./mock-data";

export type Period = "week" | "month" | "3months";
export const PERIOD_LABELS: Record<Period, string> = {
  week: "Settimana",
  month: "Mese",
  "3months": "3 Mesi",
};

/* -------------------------------------------------- */
/* Peso - punti per grafico linea                      */
/* -------------------------------------------------- */
export type WeightPoint = { date: string; label: string; weight: number };

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}
function fmtShort(d: Date): string {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(d);
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildWeightPoints(count: number, start: number, deltaPerStep: number, jitter = 0.15): WeightPoint[] {
  return Array.from({ length: count }, (_, i) => {
    const d = daysAgo(count - 1 - i);
    const noise = (Math.random() - 0.5) * jitter;
    const w = +(start + deltaPerStep * i + noise).toFixed(1);
    return { date: iso(d), label: fmtShort(d), weight: w };
  });
}

// Mock diversi per periodo - struttura pronta per API reali
const WEEK_WEIGHT = buildWeightPoints(7, 78.5, -0.18);
const MONTH_WEIGHT = buildWeightPoints(30, 80.2, -0.07);
const THREE_WEIGHT = buildWeightPoints(12, 82.0, -0.32); // 12 punti ~ settimanale su 3 mesi

const WEIGHT_MAP: Record<Period, WeightPoint[]> = {
  week: WEEK_WEIGHT,
  month: MONTH_WEIGHT,
  "3months": THREE_WEIGHT,
};

export function getWeightData(period: Period) {
  const points = WEIGHT_MAP[period];
  const first = points[0]?.weight ?? 0;
  const last = points[points.length - 1]?.weight ?? 0;
  const delta = +(last - first).toFixed(1);
  const goalOk = delta < 0; // verde se in calo
  return { current: last, delta, goalOk, points };
}

/* -------------------------------------------------- */
/* Calorie giornaliere - barre verticali              */
/* -------------------------------------------------- */
export type CaloriePoint = { date: string; label: string; calories: number };

function buildCaloriePoints(count: number, base = 2050): CaloriePoint[] {
  return Array.from({ length: count }, (_, i) => {
    const d = daysAgo(count - 1 - i);
    const cal = Math.round(base + (Math.random() - 0.5) * 600);
    return { date: iso(d), label: fmtShort(d), calories: cal };
  });
}

const WEEK_CAL = buildCaloriePoints(7, 2050);
const MONTH_CAL = buildCaloriePoints(30, 2100);
const THREE_CAL = buildCaloriePoints(12, 2080);

const CAL_MAP: Record<Period, CaloriePoint[]> = {
  week: WEEK_CAL,
  month: MONTH_CAL,
  "3months": THREE_CAL,
};

export function getCalorieData(period: Period) {
  const days = CAL_MAP[period];
  const avg = Math.round(days.reduce((s, p) => s + p.calories, 0) / days.length);
  return { average: avg, target: MOCK_CALORIE_TARGET, days };
}

/* -------------------------------------------------- */
/* Statistiche allenamento                            */
/* -------------------------------------------------- */
export type WorkoutStats = { streakDays: number; sessions: number; hours: number };

const STATS_MAP: Record<Period, WorkoutStats> = {
  week: { streakDays: 5, sessions: 4, hours: 3.2 },
  month: { streakDays: 12, sessions: 16, hours: 14.5 },
  "3months": { streakDays: 18, sessions: 42, hours: 38.0 },
};

export function getWorkoutStats(period: Period): WorkoutStats {
  return STATS_MAP[period];
}

/* -------------------------------------------------- */
/* Foto progressi - persistenza in-memory             */
/* -------------------------------------------------- */
let photoStore: ProgressPhoto[] = [
  { id: "ph-1", userId: "mock-user-1", photoUrl: "https://picsum.photos/seed/fit1/400/500", takenAt: iso(daysAgo(20)) },
  { id: "ph-2", userId: "mock-user-1", photoUrl: "https://picsum.photos/seed/fit2/400/500", takenAt: iso(daysAgo(12)) },
  { id: "ph-3", userId: "mock-user-1", photoUrl: "https://picsum.photos/seed/fit3/400/500", takenAt: iso(daysAgo(3)) },
];

export function listPhotos(): ProgressPhoto[] {
  return [...photoStore].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
}
export function addPhoto(photoUrl: string): ProgressPhoto {
  const p: ProgressPhoto = { id: `ph-${Date.now()}`, userId: "mock-user-1", photoUrl, takenAt: new Date().toISOString().slice(0, 10) };
  photoStore = [p, ...photoStore];
  return p;
}

/* -------------------------------------------------- */
/* Misurazioni corporee - store in-memory             */
/* -------------------------------------------------- */
let measurementStore: BodyMeasurement[] = [
  { id: "m-3", userId: "mock-user-1", weightKg: 78.0, waistCm: 83, hipsCm: 98, chestCm: 102, armsCm: 32, measuredAt: iso(daysAgo(22)) },
  { id: "m-2", userId: "mock-user-1", weightKg: 77.4, waistCm: 82, hipsCm: 97, chestCm: 101, armsCm: 31.5, measuredAt: iso(daysAgo(10)) },
  { id: "m-1", userId: "mock-user-1", weightKg: 77.1, waistCm: 82, hipsCm: 96, chestCm: 101, armsCm: 31.5, measuredAt: iso(daysAgo(1)) },
];

export function listMeasurements(): BodyMeasurement[] {
  return [...measurementStore].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
}
export function addMeasurement(data: Omit<BodyMeasurement, "id" | "userId" | "measuredAt"> & { measuredAt?: string }): BodyMeasurement {
  const m: BodyMeasurement = {
    id: `m-${Date.now()}`,
    userId: "mock-user-1",
    weightKg: data.weightKg,
    waistCm: data.waistCm ?? 0,
    hipsCm: data.hipsCm ?? 0,
    chestCm: data.chestCm ?? 0,
    armsCm: data.armsCm ?? 0,
    measuredAt: data.measuredAt ?? new Date().toISOString().slice(0, 10),
  };
  measurementStore = [m, ...measurementStore];
  return m;
}

export type MeasurementDiff = {
  key: "Vita" | "Fianchi" | "Petto" | "Braccia";
  current: number;
  diff: number | null; // null se prima misurazione
};

export function getCurrentMeasurementDiffs(): MeasurementDiff[] {
  const sorted = listMeasurements();
  const cur = sorted[0];
  const prev = sorted[1];
  if (!cur) return [];
  const mk = (label: MeasurementDiff["key"], curVal: number, prevVal?: number): MeasurementDiff => ({
    key: label,
    current: curVal,
    diff: prev && prevVal !== undefined ? +(curVal - prevVal).toFixed(1) : null,
  });
  return [
    mk("Vita", cur.waistCm, prev?.waistCm),
    mk("Fianchi", cur.hipsCm, prev?.hipsCm),
    mk("Petto", cur.chestCm, prev?.chestCm),
    mk("Braccia", cur.armsCm, prev?.armsCm),
  ];
}
