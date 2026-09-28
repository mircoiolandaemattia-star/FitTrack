import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "./errors";
import type { Handler } from "./types";
import { idSchema, parse } from "./validate";

const idParam = z.object({ id: idSchema });

/** La lista è sempre riferita a un giorno (obbligatorio), utente dal token. */
const listQuery = z.object({ workout_day_id: idSchema });

const createBody = z.object({
  workout_day_id: idSchema,
  name: z.string().trim().min(1).max(200),
  sets: z.number().int().min(1).max(100),
  reps: z.number().int().min(1).max(1000),
  weight_kg: z.number().min(0).max(1000).optional(),
  rest_seconds: z.number().int().min(0).max(3600).optional(),
  order_index: z.number().int().min(0),
  notes: z.string().trim().max(2000).optional(),
});

// Stessi campi del create meno il genitore (un esercizio non si sposta di
// giorno), tutti opzionali; il check qui sotto scarta il corpo vuoto.
const updateBody = createBody.omit({ workout_day_id: true }).partial();

/**
 * Proprietà a cascata: exercise -> workout_day -> workout_plan -> user.
 * 404 identico se la risorsa non esiste o se appartiene a un altro utente,
 * così non si rivela l'esistenza di id altrui (protezione IDOR/BOLA).
 */
async function ownedExercise(id: string, userId: string) {
  const exercise = await prisma.exercises.findFirst({
    where: { id, workout_day: { workout_plan: { user_id: userId } } },
  });
  if (!exercise) throw HttpError.notFound("exercise", id);
  return exercise;
}

export const listExercises: Handler = async (req) => {
  const { workout_day_id } = parse(listQuery, req.query);
  const exercises = await prisma.exercises.findMany({
    // Filtro sul giorno + proprietà: un giorno altrui non torna mai righe
    where: { workout_day_id, workout_day: { workout_plan: { user_id: req.user_id } } },
    orderBy: { order_index: "asc" },
  });
  return { status: 200, body: exercises };
};

export const createExercise: Handler = async (req) => {
  const data = parse(createBody, req.body);
  // Il giorno deve appartenere all'utente; se non esiste affatto lo
  // lasciamo fallire su P2003 (422), stesso comportamento di workout_days.
  const day = await prisma.workout_days.findUnique({
    where: { id: data.workout_day_id },
    include: { workout_plan: true },
  });
  if (day && day.workout_plan.user_id !== req.user_id) {
    throw HttpError.notFound("workout_day", data.workout_day_id);
  }
  const exercise = await prisma.exercises.create({ data });
  return { status: 201, body: exercise };
};

export const getExercise: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  return { status: 200, body: await ownedExercise(id, req.user_id) };
};

export const updateExercise: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  const data = parse(updateBody, req.body);
  if (Object.keys(data).length === 0) {
    throw HttpError.badRequest("Il corpo deve contenere almeno un campo da aggiornare.");
  }
  await ownedExercise(id, req.user_id);
  const exercise = await prisma.exercises.update({ where: { id }, data });
  return { status: 200, body: exercise };
};

export const deleteExercise: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  await ownedExercise(id, req.user_id);
  await prisma.exercises.delete({ where: { id } });
  return { status: 204 };
};
