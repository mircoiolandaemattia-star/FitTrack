import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "./errors";
import type { Handler } from "./types";
import { dateTimeSchema, idSchema, parse } from "./validate";

const idParam = z.object({ id: idSchema });

/** Filtro opzionale per piano: la lista è sempre limitata a req.user_id. */
const listQuery = z.object({ workout_plan_id: idSchema.optional() });

/**
 * `performed_data` è JSON libero, ma deve raccontare un allenamento
 * leggibile: array di esercizi con i set svolti.
 */
const performedSet = z.object({
  reps: z.number().int().min(0).max(1000),
  weight_kg: z.number().min(0).max(1000).optional(),
});
const performedDataSchema = z
  .array(
    z.object({
      exercise_id: idSchema,
      sets: z.array(performedSet).max(200),
    }),
  )
  .max(200);

const createBody = z
  .object({
    workout_plan_id: idSchema.optional(),
    workout_day_id: idSchema.optional(),
    started_at: dateTimeSchema,
    completed_at: dateTimeSchema.optional(),
    performed_data: performedDataSchema.optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((data) => !data.completed_at || data.completed_at >= data.started_at, {
    message: "completed_at non può precedere started_at.",
    path: ["completed_at"],
  });

const updateBody = z.object({
  workout_plan_id: idSchema.optional(),
  workout_day_id: idSchema.optional(),
  started_at: dateTimeSchema.optional(),
  completed_at: dateTimeSchema.optional(),
  performed_data: performedDataSchema.optional(),
  notes: z.string().trim().max(2000).optional(),
});

/**
 * Genitori opzionali (`workout_plan_id`/`workout_day_id`): se esistono ma
 * sono di un altro utente -> 404; se non esistono lasciamo fallire
 * l'operazione su P2003 -> 422, come nel resto delle API.
 */
async function assertParentsUsable(
  refs: { workout_plan_id?: string; workout_day_id?: string },
  userId: string,
): Promise<void> {
  if (refs.workout_plan_id) {
    const plan = await prisma.workout_plans.findUnique({
      where: { id: refs.workout_plan_id },
    });
    if (plan && plan.user_id !== userId) {
      throw HttpError.notFound("workout_plan", refs.workout_plan_id);
    }
  }
  if (refs.workout_day_id) {
    const day = await prisma.workout_days.findUnique({
      where: { id: refs.workout_day_id },
      include: { workout_plan: true },
    });
    if (day && day.workout_plan.user_id !== userId) {
      throw HttpError.notFound("workout_day", refs.workout_day_id);
    }
  }
}

/** Sessione visibile solo se dell'utente del token (mai un `:id` altrui). */
async function ownedSession(id: string, userId: string) {
  const session = await prisma.workout_sessions.findFirst({
    where: { id, user_id: userId },
  });
  if (!session) throw HttpError.notFound("workout_session", id);
  return session;
}

export const listWorkoutSessions: Handler = async (req) => {
  const { workout_plan_id } = parse(listQuery, req.query);
  const sessions = await prisma.workout_sessions.findMany({
    // user_id dal token: un filtro sul piano altrui non torna mai righe
    where: {
      user_id: req.user_id,
      ...(workout_plan_id ? { workout_plan_id } : {}),
    },
    orderBy: { started_at: "desc" },
  });
  return { status: 200, body: sessions };
};

export const createWorkoutSession: Handler = async (req) => {
  const data = parse(createBody, req.body);
  await assertParentsUsable(data, req.user_id);
  const session = await prisma.workout_sessions.create({
    data: { ...data, user_id: req.user_id },
  });
  return { status: 201, body: session };
};

export const getWorkoutSession: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  return { status: 200, body: await ownedSession(id, req.user_id) };
};

export const updateWorkoutSession: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  const data = parse(updateBody, req.body);
  if (Object.keys(data).length === 0) {
    throw HttpError.badRequest("Il corpo deve contenere almeno un campo da aggiornare.");
  }
  const current = await ownedSession(id, req.user_id);
  await assertParentsUsable(data, req.user_id);

  // Vincolo di coerenza anche quando i due timestamp arrivano in richieste
  // diverse: si valuta lo stato risultante, non solo il singolo input.
  const started_at = data.started_at ?? current.started_at;
  const completed_at = data.completed_at ?? current.completed_at;
  if (completed_at && completed_at < started_at) {
    throw HttpError.badRequest("completed_at non può precedere started_at.");
  }

  const session = await prisma.workout_sessions.update({
    where: { id },
    data: { ...data, started_at, completed_at },
  });
  return { status: 200, body: session };
};

export const deleteWorkoutSession: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  await ownedSession(id, req.user_id);
  // workout_plan_id/workout_day_id sono SetNull a livello DB
  await prisma.workout_sessions.delete({ where: { id } });
  return { status: 204 };
};
