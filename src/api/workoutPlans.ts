import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "./errors";
import type { Handler } from "./types";
import { idSchema, parse } from "./validate";

/** Query: lista filtrata per utente. */
const listQuery = z.object({ user_id: idSchema });

const idParam = z.object({ id: idSchema });

const createBody = z.object({
  user_id: idSchema,
  name: z.string().trim().min(1).max(200),
  source: z.enum(["manual", "ai", "upload"]),
  is_active: z.boolean().default(true),
});

const updateBody = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  source: z.enum(["manual", "ai", "upload"]).optional(),
  is_active: z.boolean().optional(),
});

export const listWorkoutPlans: Handler = async (req) => {
  const { user_id } = parse(listQuery, req.query);
  const plans = await prisma.workout_plans.findMany({
    where: { user_id },
    orderBy: { created_at: "desc" },
  });
  return { status: 200, body: plans };
};

export const createWorkoutPlan: Handler = async (req) => {
  const data = parse(createBody, req.body);
  const plan = await prisma.workout_plans.create({ data });
  return { status: 201, body: plan };
};

export const getWorkoutPlan: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  const plan = await prisma.workout_plans.findUnique({ where: { id } });
  if (!plan) throw HttpError.notFound("workout_plan", id);
  return { status: 200, body: plan };
};

export const updateWorkoutPlan: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  const data = parse(updateBody, req.body);
  if (Object.keys(data).length === 0) {
    throw HttpError.badRequest("Il corpo deve contenere almeno un campo da aggiornare.");
  }
  const plan = await prisma.workout_plans.update({ where: { id }, data });
  return { status: 200, body: plan };
};

export const deleteWorkoutPlan: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  // Cascata su workout_days -> exercises (vincolo a livello DB)
  await prisma.workout_plans.delete({ where: { id } });
  return { status: 204 };
};
