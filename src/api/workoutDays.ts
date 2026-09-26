import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "./errors";
import type { Handler } from "./types";
import { idSchema, parse } from "./validate";

/** Query: lista filtrata per piano di allenamento. */
const listQuery = z.object({ workout_plan_id: idSchema });

const idParam = z.object({ id: idSchema });

const createBody = z.object({
  workout_plan_id: idSchema,
  name: z.string().trim().min(1).max(200),
  day_order: z.number().int().min(0),
});

const updateBody = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  day_order: z.number().int().min(0).optional(),
});

export const listWorkoutDays: Handler = async (req) => {
  const { workout_plan_id } = parse(listQuery, req.query);
  const days = await prisma.workout_days.findMany({
    where: { workout_plan_id },
    orderBy: { day_order: "asc" },
  });
  return { status: 200, body: days };
};

export const createWorkoutDay: Handler = async (req) => {
  const data = parse(createBody, req.body);
  // Se il piano non esiste, Prisma risponde P2003 → 422
  const day = await prisma.workout_days.create({ data });
  return { status: 201, body: day };
};

export const getWorkoutDay: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  const day = await prisma.workout_days.findUnique({ where: { id } });
  if (!day) throw HttpError.notFound("workout_day", id);
  return { status: 200, body: day };
};

export const updateWorkoutDay: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  const data = parse(updateBody, req.body);
  if (Object.keys(data).length === 0) {
    throw HttpError.badRequest("Il corpo deve contenere almeno un campo da aggiornare.");
  }
  const day = await prisma.workout_days.update({ where: { id }, data });
  return { status: 200, body: day };
};

export const deleteWorkoutDay: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  // Cascata su exercises (vincolo a livello DB)
  await prisma.workout_days.delete({ where: { id } });
  return { status: 204 };
};
