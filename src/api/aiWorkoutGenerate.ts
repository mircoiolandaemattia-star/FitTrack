import { z } from "zod";
import { prisma } from "../lib/prisma";
import { assertPremium, recordAiUsage } from "./lib/aiAccess";
import { aiWorkoutPlanSchema } from "./lib/aiSchemas";
import { generateGemini } from "./lib/gemini";
import type { Handler } from "./types";
import { parse } from "./validate";

/**
 * Generazione di una scheda allenamento: obiettivo, livello, giorni
 * disponibili ed attrezzatura → piano con giorni ed esercizi, salvato
 * direttamente come `workout_plans` (`source: "ai"`).
 *
 * Accesso: solo `users.subscription_status === "premium"`, riletto dalla
 * tabella ad ogni richiesta → altrimenti 403 `PREMIUM_REQUIRED`.
 * L'uso viene loggato **dopo** il salvataggio riuscito: un salvataggio che
 * fallisce non deve consumare la quota.
 */
const createBody = z.object({
  goal: z.string().trim().min(2).max(300),
  level: z.string().trim().max(60).default(""),
  days_per_week: z.number().int().min(1).max(7),
  equipment: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  notes: z.string().trim().max(600).default(""),
  /** Nome del piano: se omesso si usa quello generato da Gemini. */
  name: z.string().trim().min(1).max(200).optional(),
});

const SYSTEM =
  "Sei un personal trainer che programma in multifrequenza. Ogni gruppo " +
  "muscolare va allenato 2-3 volte nella settimana: preferisci split full " +
  "body, upper/lower o push/pull/legs ripetuti, mai un muscolo lavorato una " +
  "sola volta a settimana. Componi schede realistiche e coerenti con " +
  "obiettivo, livello e attrezzatura indicati, mettendo in testa gli " +
  "esercizi composti, con progressioni ragionevoli di serie e ripetizioni, " +
  "riposi e tecniche plausibili. Rispondi esclusivamente con JSON valido, " +
  "senza testo fuori dal JSON e senza markdown.";

/**
 * Split consigliato in funzione dei giorni richiesti: passa nel prompt così
 * il modello riparte da una struttura a multifrequenza invece di dividere i
 * muscoli in sedute singole (il classico errore delle schede generate).
 */
function splitSuggestion(days: number): string {
  switch (days) {
    case 1:
      return "1 giorno → full body: tutti i gruppi principali in un'unica seduta.";
    case 2:
      return "2 giorni → full body A/B: ogni gruppo 2 volte a settimana.";
    case 3:
      return "3 giorni → full body A/B/C oppure Upper / Lower / Full body.";
    case 4:
      return "4 giorni → Upper / Lower ripetuti due volte.";
    case 5:
      return "5 giorni → Upper / Lower più Push, Pull, Legs.";
    case 6:
      return "6 giorni → Push, Pull, Legs ripetuti due volte.";
    default:
      return "7 giorni → Upper / Lower tre volte più un full body.";
  }
}

const PROMPT_FORMAT =
  'Rispondi SOLO con questo JSON: {"name":"Full body A/B", "days":[' +
  '{"name":"Giorno 1 — Full body","exercises":[{"name":"Squat", "sets":4, ' +
  '"reps":8,"weight_kg":60,"rest_seconds":150,"notes":"scendere in 2 secondi"}]}]} ' +
  "— esattamente il numero di days richiesti, almeno 3 esercizi per giorno; " +
  "weight_kg (carico di partenza) può essere 0 se l'utente è principiante, " +
  "rest_seconds e notes sono opzionali. Nel name della scheda indica lo split usato.";

export const generateWorkout: Handler = async (req) => {
  const data = parse(createBody, req.body);

  // Gating premium: nessun valore arriva dal client, si legge il DB.
  await assertPremium(req.user_id);

  const generated = await generateGemini({
    schema: aiWorkoutPlanSchema,
    system: SYSTEM,
    prompt:
      `Obiettivo: ${data.goal}\n` +
      (data.level ? `Livello: ${data.level}\n` : "") +
      `Giorni a settimana: ${data.days_per_week}\n` +
      `Attrezzatura disponibile: ${data.equipment.length ? data.equipment.join(", ") : "nessuna indicazione"}\n` +
      (data.notes ? `Note: ${data.notes}\n` : "") +
      `Genera esattamente ${data.days_per_week} giorni.\n` +
      `Multifrequenza obbligatoria: ogni gruppo muscolare deve comparire 2 o ` +
      `3 volte nei giorni generati; i giorni possono ripetere gli stessi ` +
      `esercizi base (non creare uno split in cui un muscolo lavora una volta sola).\n` +
      `Split consigliato: ${splitSuggestion(data.days_per_week)}\n` +
      `Volume: 4-8 serie per gruppo muscolare in ogni seduta e 10-20 serie ` +
      `a settimana per i grandi gruppi.\n` +
      PROMPT_FORMAT,
    temperature: 0.6,
  });

  // Piano + giorni + esercizi in una sola transazione implicita (nested create)
  const plan = await prisma.workout_plans.create({
    data: {
      user_id: req.user_id,
      name: data.name ?? generated.name,
      source: "ai",
      workout_days: {
        create: generated.days.map((day, dayIndex) => ({
          name: day.name,
          // Convenzione del client (lib/workoutQueries): 1 = lunedì …
          // 7 = domenica. Con day_order 0-based il primo giorno veniva
          // mappato due volte sul lunedì e uno dei due risultava invisibile
          // nella vista settimanale.
          day_order: dayIndex + 1,
          exercises: {
            create: day.exercises.map((exercise, exerciseIndex) => ({
              name: exercise.name,
              sets: exercise.sets,
              reps: exercise.reps,
              weight_kg: exercise.weight_kg ?? null,
              rest_seconds: exercise.rest_seconds ?? null,
              notes: exercise.notes ?? null,
              order_index: exerciseIndex,
            })),
          },
        })),
      },
    },
    // Stessa forma del GET /workout-plans/:id: giorni ed esercizi già ordinati
    include: {
      workout_days: {
        orderBy: { day_order: "asc" },
        include: { exercises: { orderBy: { order_index: "asc" } } },
      },
    },
  });

  await recordAiUsage(req.user_id, "workout_generation");
  return { status: 201, body: plan };
};
