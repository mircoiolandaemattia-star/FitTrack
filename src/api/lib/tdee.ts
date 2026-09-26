/**
 * Target nutrizionali giornalieri (TDEE): **unica** implementazione della
 * formula, usata sia dall'onboarding (`POST /api/users`) sia dal ricalcolo
 * (`PUT /api/users/me`). Nessuna duplicazione: cambiando la formula qui,
 * cambiano entrambi i percorsi.
 *
 * BMR (Mifflin-St Jeor):
 *   uomo:  10*peso_kg + 6.25*altezza_cm - 5*eta + 5
 *   donna: 10*peso_kg + 6.25*altezza_cm - 5*eta - 161
 *   other: media dei due risultati
 */

/** Moltiplicatore per livello di attività. */
const ACTIVITY_MULTIPLIER: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Aggiustamento calorico per obiettivo. */
const GOAL_ADJUSTMENT: Record<string, number> = {
  lose: 0.8,
  maintain: 1.0,
  gain: 1.1,
};

export interface TdeeInput {
  /** Data di nascita (mezzanotte UTC, arrivata dal client come "YYYY-MM-DD"). */
  birthDate: Date;
  /** "male" | "female" | "other" (`null` → trattato come "other"). */
  gender: string | null;
  heightCm: number;
  weightKg: number;
  /** "lose" | "maintain" | "gain". */
  goal: string;
  /** "sedentary" | "light" | "moderate" | "active" | "very_active". */
  activityLevel: string;
}

/** I quattro valori persistiti su `users` (colonne Int). */
export interface NutritionalTargets {
  daily_calorie_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
}

/**
 * Età in anni compiuti rispetto alla data odierna.
 * La data di nascita è memorizzata a mezzanotte UTC: se ne usano le parti
 * UTC; "oggi" è la data locale (quella che l'utente vede).
 */
export function ageFromBirthDate(birthDate: Date, today: Date = new Date()): number {
  const age =
    today.getFullYear() -
    birthDate.getUTCFullYear() -
    (today.getMonth() < birthDate.getUTCMonth() ||
    (today.getMonth() === birthDate.getUTCMonth() && today.getDate() < birthDate.getUTCDate())
      ? 1
      : 0);
  return Math.max(age, 0);
}

/** BMR Mifflin-St Jeor; "other" (o gender assente) = media di uomo e donna. */
function basalMetabolicRate(input: TdeeInput, age: number): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * age;
  if (input.gender === "male") return base + 5;
  if (input.gender === "female") return base - 161;
  return base + (5 - 161) / 2;
}

/**
 * Calcola i target partendo dai dati del profilo (valori già validati con
 * zod a monte: gli enum qui sono noti; il `??` è solo un ripiego difensivo
 * per righe legacy, evita NaN senza mai zittire la richiesta).
 */
export function computeTargets(input: TdeeInput): NutritionalTargets {
  const bmr = basalMetabolicRate(input, ageFromBirthDate(input.birthDate));
  const activity = ACTIVITY_MULTIPLIER[input.activityLevel] ?? ACTIVITY_MULTIPLIER.sedentary;
  const goalAdjustment = GOAL_ADJUSTMENT[input.goal] ?? GOAL_ADJUSTMENT.maintain;

  const daily_calorie_target = Math.round(bmr * activity * goalAdjustment);
  const protein_target_g = Math.round(1.8 * input.weightKg);
  const fat_target_g = Math.round((daily_calorie_target * 0.25) / 9);
  const carbs_target_g = Math.round(
    (daily_calorie_target - protein_target_g * 4 - fat_target_g * 9) / 4,
  );

  return { daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g };
}
