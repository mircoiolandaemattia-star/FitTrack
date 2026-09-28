import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "./errors";
import type { Handler } from "./types";
import { idSchema, parse } from "./validate";

const idParam = z.object({ id: idSchema });

// `user_id` non è un campo dell'input: arriva dal JWT (req.user_id)
const createBody = z.object({
  name: z.string().trim().min(1).max(200),
  source: z.enum(["manual", "ai", "upload"]),
  is_active: z.boolean().default(true),
  // Target opzionali: un piano manuale può nascere senza macro
  daily_calorie_target: z.number().int().min(0).max(20000).optional(),
  protein_g: z.number().int().min(0).max(2000).optional(),
  carbs_g: z.number().int().min(0).max(3000).optional(),
  fat_g: z.number().int().min(0).max(1000).optional(),
});

const updateBody = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  source: z.enum(["manual", "ai", "upload"]).optional(),
  is_active: z.boolean().optional(),
  daily_calorie_target: z.number().int().min(0).max(20000).optional(),
  protein_g: z.number().int().min(0).max(2000).optional(),
  carbs_g: z.number().int().min(0).max(3000).optional(),
  fat_g: z.number().int().min(0).max(1000).optional(),
});

/**
 * Piano accessibile solo al proprietario: se non esiste o appartiene a un
 * altro utente la risposta è la stessa (404), così non si rivela l'esistenza
 * di id altrui (protezione contro IDOR/BOLA).
 */
async function ownedDietPlan(id: string, userId: string) {
  const plan = await prisma.diet_plans.findFirst({
    where: { id, user_id: userId },
  });
  if (!plan) throw HttpError.notFound("diet_plan", id);
  return plan;
}

export const listDietPlans: Handler = async (req) => {
  const plans = await prisma.diet_plans.findMany({
    where: { user_id: req.user_id },
    orderBy: { created_at: "desc" },
  });
  return { status: 200, body: plans };
};

export const createDietPlan: Handler = async (req) => {
  const data = parse(createBody, req.body);
  const plan = await prisma.diet_plans.create({
    data: { ...data, user_id: req.user_id },
  });
  return { status: 201, body: plan };
};

export const getDietPlan: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  return { status: 200, body: await ownedDietPlan(id, req.user_id) };
};

export const updateDietPlan: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  const data = parse(updateBody, req.body);
  if (Object.keys(data).length === 0) {
    throw HttpError.badRequest("Il corpo deve contenere almeno un campo da aggiornare.");
  }
  await ownedDietPlan(id, req.user_id);
  const plan = await prisma.diet_plans.update({ where: { id }, data });
  return { status: 200, body: plan };
};

export const deleteDietPlan: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  await ownedDietPlan(id, req.user_id);
  // meals.diet_plan_id è SetNull a livello DB (i pasti restano)
  await prisma.diet_plans.delete({ where: { id } });
  return { status: 204 };
};
