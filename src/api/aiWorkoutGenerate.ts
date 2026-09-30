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
  "Sei un personal trainer. Proponi schede di allenamento realistiche, " +
  "coerenti con obiettivo, livello e attrezzatura indicati, con progressioni " +
  "ragionevoli di serie e ripetizioni. Rispondi esclusivamente con JSON " +
  "valido, senza testo fuori dal JSON e senza markdown.";

const PROMPT_FORMAT =
  'Rispondi SOLO con questo JSON: {"name":"Push Pull Legs", "days":[' +
  '{"name":"Giorno A — Push","exercises":[{"name":"Panca piana", "sets":4, ' +
  '"reps":8,"weight_kg":60,"rest_seconds":120,"notes":"tenere il ritmo"}]}]} ' +
  "— un numero di days uguale a giorni/settimana richiesti, almeno 2 " +
  "esercizi per giorno, weight_kg (carico di partenza) può essere 0 se " +
  "l'utente è principiante, notes è opzionale.";

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
