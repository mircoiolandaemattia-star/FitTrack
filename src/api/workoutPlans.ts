import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "./errors";
import type { Handler } from "./types";
import { idSchema, parse } from "./validate";

const idParam = z.object({ id: idSchema });

// `user_id` non è più un campo dell'input: arriva dal JWT (req.user_id)
const createBody = z.object({
  name: z.string().trim().min(1).max(200),
  source: z.enum(["manual", "ai", "upload"]),
  is_active: z.boolean().default(true),
});

const updateBody = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  source: z.enum(["manual", "ai", "upload"]).optional(),
  is_active: z.boolean().optional(),
});

/**
 * Piano accessibile solo al proprietario: se non esiste o appartiene a un
 * altro utente la risposta è la stessa (404), così non si rivela l'esistenza
 * di id altrui (protezione contro IDOR/BOLA).
 */
async function ownedWorkoutPlan(id: string, userId: string) {
  const plan = await prisma.workout_plans.findFirst({
    where: { id, user_id: userId },
  });
  if (!plan) throw HttpError.notFound("workout_plan", id);
  return plan;
}

export const listWorkoutPlans: Handler = async (req) => {
  const plans = await prisma.workout_plans.findMany({
    where: { user_id: req.user_id },
    orderBy: { created_at: "desc" },
  });
  return { status: 200, body: plans };
};

export const createWorkoutPlan: Handler = async (req) => {
  const data = parse(createBody, req.body);
  const plan = await prisma.workout_plans.create({
    data: { ...data, user_id: req.user_id },
  });
  return { status: 201, body: plan };
};

export const getWorkoutPlan: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  return { status: 200, body: await ownedWorkoutPlan(id, req.user_id) };
};

export const updateWorkoutPlan: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  const data = parse(updateBody, req.body);
  if (Object.keys(data).length === 0) {
    throw HttpError.badRequest("Il corpo deve contenere almeno un campo da aggiornare.");
  }
  await ownedWorkoutPlan(id, req.user_id);
  const plan = await prisma.workout_plans.update({ where: { id }, data });
  return { status: 200, body: plan };
};

export const deleteWorkoutPlan: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  await ownedWorkoutPlan(id, req.user_id);
  // Cascata su workout_days -> exercises (vincolo a livello DB)
  await prisma.workout_plans.delete({ where: { id } });
  return { status: 204 };
};
