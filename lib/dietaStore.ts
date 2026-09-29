/**
 * Helper condivisi della schermata Dieta: etichette dei pasti e utility data.
 * I dati (pasti, alimenti, totali) arrivano da React Query: `lib/dietQueries.ts`.
 */

/** Tipi pasto supportati (etichette UI; l'API usa gli enum `meal_type`). */
export const MEAL_TYPES = ["Colazione", "Pranzo", "Cena", "Snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

/* ------------------------------------------------------------------ */
/* Helpers per data (in fuso LOCALE: il giorno dell'app è quello utente) */
/* ------------------------------------------------------------------ */

export function formatDayLabel(date: Date): string {
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  if (isToday) return "Oggi";
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(date);
}

/** Data locale → `YYYY-MM-DD` (con `toISOString` si finirebbe sul giorno UTC). */
export function dateToString(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(date: Date, offset: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + offset);
  return d;
}
