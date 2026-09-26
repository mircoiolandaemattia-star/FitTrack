import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "./errors";
import type { Handler } from "./types";
import { idSchema, parse } from "./validate";

/** Query: lista filtrata per piano di allenamento. */
const listQuery = z.object({ workout_plan_id: idSchema });

const idParam = z.object({ id: idSchema });

// `user_id` non è più un campo dell'input: arriva dal JWT (req.user_id)
const createBody = z.object({
  workout_plan_id: idSchema,
  name: z.string().trim().min(1).max(200),
  day_order: z.number().int().min(0),
});

const updateBody = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  day_order: z.number().int().min(0).optional(),
});

/**
 * Giorno accessibile solo se il piano di appartenenza è dell'utente:
 * 404 identico in entrambi i casi (inesistente o altrui), niente leak.
 */
async function ownedWorkoutDay(id: string, userId: string) {
  const day = await prisma.workout_days.findFirst({
    where: { id, workout_plan: { user_id: userId } },
  });
  if (!day) throw HttpError.notFound("workout_day", id);
  return day;
}

export const listWorkoutDays: Handler = async (req) => {
  const { workout_plan_id } = parse(listQuery, req.query);
  const days = await prisma.workout_days.findMany({
    where: { workout_plan_id, workout_plan: { user_id: req.user_id } },
    orderBy: { day_order: "asc" },
  });
  return { status: 200, body: days };
};

export const createWorkoutDay: Handler = async (req) => {
  const data = parse(createBody, req.body);
  // Il piano deve appartenere all'utente autenticato; se non esiste affatto
  // lo lasciamo fallire su P2003 (422) come dal comportamento pre-auth.
  const plan = await prisma.workout_plans.findFirst({
    where: { id: data.workout_plan_id },
  });
  if (plan && plan.user_id !== req.user_id) {
    throw HttpError.notFound("workout_plan", data.workout_plan_id);
  }
  const day = await prisma.workout_days.create({ data });
  return { status: 201, body: day };
};

export const getWorkoutDay: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  return { status: 200, body: await ownedWorkoutDay(id, req.user_id) };
};

export const updateWorkoutDay: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  const data = parse(updateBody, req.body);
  if (Object.keys(data).length === 0) {
    throw HttpError.badRequest("Il corpo deve contenere almeno un campo da aggiornare.");
  }
  await ownedWorkoutDay(id, req.user_id);
  const day = await prisma.workout_days.update({ where: { id }, data });
  return { status: 200, body: day };
};

export const deleteWorkoutDay: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  await ownedWorkoutDay(id, req.user_id);
  // Cascata su exercises (vincolo a livello DB)
  await prisma.workout_days.delete({ where: { id } });
  return { status: 204 };
};
