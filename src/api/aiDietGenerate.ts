import { z } from "zod";
import { prisma } from "../lib/prisma";
import { assertPremium, recordAiUsage } from "./lib/aiAccess";
import { aiDietPlanSchema } from "./lib/aiSchemas";
import { generateGemini } from "./lib/gemini";
import type { Handler } from "./types";
import { parse } from "./validate";

/**
 * Generazione di una dieta: obiettivo, allergie, preferenze e numero di
 * pasti → `diet_plans` con pasti ed alimenti annidati (`source: "ai"`).
 *
 * Accesso: solo `users.subscription_status === "premium"`, riletto dalla
 * tabella ad ogni richiesta → altrimenti 403 `PREMIUM_REQUIRED`.
 * L'uso viene loggato **dopo** il salvataggio riuscito.
 */
const createBody = z.object({
  goal: z.string().trim().min(2).max(300),
  allergies: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  /** Tipo di dieta: "onnivoro", "vegetariano", "vegano", … (testo libero). */
  diet_type: z.string().trim().max(60).default(""),
  meals_per_day: z.number().int().min(2).max(6),
  notes: z.string().trim().max(600).default(""),
  /** Nome del piano: se omesso si usa quello generato da Gemini. */
  name: z.string().trim().min(1).max(200).optional(),
});

const SYSTEM =
  "Sei un nutrizionista. Componi giornate alimentari bilanciate e reali, " +
  "coerenti con obiettivo, allergie e tipo di dieta indicati, con porzioni " +
  "e valori nutrizionali plausibili. Rispondi esclusivamente con JSON " +
  "valido, senza testo fuori dal JSON e senza markdown.";

const PROMPT_FORMAT =
  'Rispondi SOLO con questo JSON: {"name":"Dieta definizione", ' +
  '"daily_calorie_target":2100,"protein_g":160,"carbs_g":230,"fat_g":60,' +
  '"meals":[{"meal_type":"breakfast","name":"Colazione","foods":[' +
  '{"name":"Fiocchi d\'avena","quantity_g":80,"calories":300,' +
  '"protein_g":11,"carbs_g":54,"fat_g":5}]}]} ' +
  "— meal_type è breakfast, lunch, dinner oppure snack; il numero di meals " +
  "deve essere esattamente quello richiesto; calories sono kcal totali della " +
  "porzione e le macro sono grammi totali. Le tabelle daily_calorie_target e " +
  "le macro sono i totali giornalieri della dieta (non di un pasto).";

export const generateDiet: Handler = async (req) => {
  const data = parse(createBody, req.body);

  // Gating premium: nessun valore arriva dal client, si legge il DB.
  await assertPremium(req.user_id);

  const generated = await generateGemini({
    schema: aiDietPlanSchema,
    system: SYSTEM,
    prompt:
      `Obiettivo: ${data.goal}\n` +
      (data.diet_type ? `Tipo di dieta: ${data.diet_type}\n` : "") +
      (data.allergies.length
        ? `Allergie/intolleranze da escludere: ${data.allergies.join(", ")}\n`
        : "") +
      `Pasti al giorno: ${data.meals_per_day}\n` +
      (data.notes ? `Note: ${data.notes}\n` : "") +
      PROMPT_FORMAT,
    temperature: 0.7,
  });

  // I pasti di un piano generato partono da oggi: la colonna `date` è
  // NOT NULL e il diario li raggiunge filtrando per data (mezzanotte UTC,
  // stesso formato del POST /meals del client).
  const today = new Date(new Date().toISOString().slice(0, 10));

  const plan = await prisma.diet_plans.create({
    data: {
      user_id: req.user_id,
      name: data.name ?? generated.name,
      source: "ai",
      daily_calorie_target: generated.daily_calorie_target ?? null,
      protein_g: generated.protein_g ?? null,
      carbs_g: generated.carbs_g ?? null,
      fat_g: generated.fat_g ?? null,
      meals: {
        create: generated.meals.map((meal) => ({
          user_id: req.user_id,
          meal_type: meal.meal_type,
          date: today,
          name: meal.name ?? null,
          food_items: {
            create: meal.foods.map((food) => ({
              name: food.name,
              quantity_g: food.quantity_g,
              calories: food.calories,
              protein_g: food.protein_g,
              carbs_g: food.carbs_g,
              fat_g: food.fat_g,
              source: "ai",
            })),
          },
        })),
      },
    },
    include: {
      meals: {
        // In una transazione `now()` è identico per tutte le righe: senza un
        // criterio secondario l'ordine dei pasti sarebbe casuale.
        orderBy: [{ created_at: "asc" }, { meal_type: "asc" }],
        include: {
          food_items: { orderBy: [{ created_at: "asc" }, { name: "asc" }] },
        },
      },
    },
  });

  await recordAiUsage(req.user_id, "diet_generation");
  return { status: 201, body: plan };
};
