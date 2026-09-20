/**
 * Calcolo fabbisogno calorico giornaliero.
 * Formula Harris-Benedict + fattore attività + aggiustamento obiettivo.
 * Struttura pronta per API reali.
 */

export type Gender = "male" | "female" | "other";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "high";
export type Goal = "dimagrire" | "mantenimento" | "massa";

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
};

const GOAL_DELTA: Record<Goal, number> = {
  dimagrire: -400,
  mantenimento: 0,
  massa: 350,
};

export function calculateTDEE(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: Gender | string | null,
  activityLevel: ActivityLevel | string | null,
  goal: Goal | string | null
): number | null {
  if (!weightKg || !heightCm || !age) return null;

  const g = (gender as Gender) ?? "male";
  const a = (activityLevel as ActivityLevel) ?? "moderate";
  const gl = (goal as Goal) ?? "mantenimento";

  // Harris-Benedict
  let bmr: number;
  if (g === "female") {
    bmr = 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age;
  } else {
    // male / other → formula maschile
    bmr = 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age;
  }

  const factor = ACTIVITY_FACTOR[a] ?? 1.55;
  const delta = GOAL_DELTA[gl] ?? 0;
  return Math.round(bmr * factor + delta);
}

export const GOAL_OPTIONS: { key: Goal; label: string; description: string }[] = [
  { key: "dimagrire", label: "Dimagrire", description: "Deficit moderato per favorire la perdita di grasso preservando la massa muscolare." },
  { key: "mantenimento", label: "Mantenimento", description: "Mantieni il peso attuale con equilibrio tra energia e attività." },
  { key: "massa", label: "Massa muscolare", description: "Surplus controllato per supportare ipertrofia e recupero." },
];

export const ACTIVITY_OPTIONS: { key: ActivityLevel; label: string; description: string }[] = [
  { key: "sedentary", label: "Sedentario", description: "Poco o nessun esercizio, lavoro d'ufficio." },
  { key: "light", label: "Leggermente attivo", description: "Esercizio leggero 1-3 giorni a settimana." },
  { key: "moderate", label: "Moderatamente attivo", description: "Esercizio moderato 3-5 giorni a settimana." },
  { key: "high", label: "Molto attivo", description: "Esercizio intenso 6-7 giorni a settimana." },
];
