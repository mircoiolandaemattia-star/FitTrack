import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "./errors";
import type { Handler } from "./types";
import { dateSchema, idSchema, parse, rangeQuerySchema } from "./validate";

const idParam = z.object({ id: idSchema });

/** Colonne di misurazione: tutte opzionali, il vincolo "almeno una" è sotto. */
const measurementFields = {
  weight_kg: z.number().min(20).max(400).optional(),
  waist_cm: z.number().min(20).max(300).optional(),
  hips_cm: z.number().min(20).max(300).optional(),
  chest_cm: z.number().min(20).max(300).optional(),
  arms_cm: z.number().min(10).max(100).optional(),
};

const NUMERIC_FIELDS = [
  "weight_kg",
  "waist_cm",
  "hips_cm",
  "chest_cm",
  "arms_cm",
] as const;

// `user_id` non è un campo dell'input: arriva dal JWT (req.user_id)
const createBody = z
  .object({ date: dateSchema, ...measurementFields })
  .refine(
    (data) => NUMERIC_FIELDS.some((field) => data[field] !== undefined),
    {
      message:
        "Almeno un campo fra weight_kg, waist_cm, hips_cm, chest_cm e arms_cm.",
    },
  );

const updateBody = z.object({ date: dateSchema.optional(), ...measurementFields });

/** Misurazione visibile solo se dell'utente del token. */
async function ownedMeasurement(id: string, userId: string) {
  const measurement = await prisma.body_measurements.findFirst({
    where: { id, user_id: userId },
  });
  if (!measurement) throw HttpError.notFound("body_measurement", id);
  return measurement;
}

export const listBodyMeasurements: Handler = async (req) => {
  const { from, to } = parse(rangeQuerySchema, req.query);
  // Range opzionale con estremi inclusi; senza parametri torna tutto
  const dateFilter =
    from !== undefined || to !== undefined
      ? {
          ...(from !== undefined ? { gte: new Date(from) } : {}),
          ...(to !== undefined ? { lte: new Date(to) } : {}),
        }
      : undefined;
  const measurements = await prisma.body_measurements.findMany({
    where: { user_id: req.user_id, date: dateFilter },
    orderBy: { date: "desc" },
  });
  return { status: 200, body: measurements };
};

export const createBodyMeasurement: Handler = async (req) => {
  const data = parse(createBody, req.body);
  const measurement = await prisma.body_measurements.create({
    data: { ...data, date: new Date(data.date), user_id: req.user_id },
  });
  return { status: 201, body: measurement };
};

export const getBodyMeasurement: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  return { status: 200, body: await ownedMeasurement(id, req.user_id) };
};

export const updateBodyMeasurement: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  const data = parse(updateBody, req.body);
  if (Object.keys(data).length === 0) {
    throw HttpError.badRequest("Il corpo deve contenere almeno un campo da aggiornare.");
  }
  await ownedMeasurement(id, req.user_id);
  const measurement = await prisma.body_measurements.update({
    where: { id },
    data: { ...data, ...(data.date !== undefined ? { date: new Date(data.date) } : {}) },
  });
  return { status: 200, body: measurement };
};

export const deleteBodyMeasurement: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  await ownedMeasurement(id, req.user_id);
  await prisma.body_measurements.delete({ where: { id } });
  return { status: 204 };
};
