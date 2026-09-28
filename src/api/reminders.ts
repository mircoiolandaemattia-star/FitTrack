import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "./errors";
import type { Handler } from "./types";
import { idSchema, parse } from "./validate";

const idParam = z.object({ id: idSchema });

/**
 * "HH:MM" su 24 ore con due cifre: oltre che validare, garantisce che
 * l'ordinamento testuale coincida con quello cronologico.
 */
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato non valido: serve HH:MM (00:00–23:59).");

/**
 * Giorni della settimana: interi 0–6, almeno uno, nessun duplicato di
 * scopo. La corrispondenza fra numero e giorno la decide il client
 * (nell'app è `DayOfWeek` letterale): qui si valida solo il vincolo.
 */
const daysOfWeekSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1)
  .max(7);

// `user_id` non è un campo dell'input: arriva dal JWT (req.user_id)
const createBody = z.object({
  type: z.enum(["workout", "meal", "measurement", "custom"]),
  time: timeSchema,
  days_of_week: daysOfWeekSchema,
  message: z.string().trim().max(500).optional(),
  is_active: z.boolean().default(true),
});

const updateBody = z.object({
  type: z.enum(["workout", "meal", "measurement", "custom"]).optional(),
  time: timeSchema.optional(),
  days_of_week: daysOfWeekSchema.optional(),
  message: z.string().trim().max(500).optional(),
  is_active: z.boolean().optional(),
});

/** Promemoria visibile solo se dell'utente del token. */
async function ownedReminder(id: string, userId: string) {
  const reminder = await prisma.reminders.findFirst({
    where: { id, user_id: userId },
  });
  if (!reminder) throw HttpError.notFound("reminder", id);
  return reminder;
}

export const listReminders: Handler = async (req) => {
  const reminders = await prisma.reminders.findMany({
    where: { user_id: req.user_id },
    // time è "HH:MM" a due cifre: ordinare per stringa = ordinare per orario
    orderBy: { time: "asc" },
  });
  return { status: 200, body: reminders };
};

export const createReminder: Handler = async (req) => {
  const data = parse(createBody, req.body);
  const reminder = await prisma.reminders.create({
    data: { ...data, user_id: req.user_id },
  });
  return { status: 201, body: reminder };
};

export const getReminder: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  return { status: 200, body: await ownedReminder(id, req.user_id) };
};

export const updateReminder: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  const data = parse(updateBody, req.body);
  if (Object.keys(data).length === 0) {
    throw HttpError.badRequest("Il corpo deve contenere almeno un campo da aggiornare.");
  }
  await ownedReminder(id, req.user_id);
  const reminder = await prisma.reminders.update({ where: { id }, data });
  return { status: 200, body: reminder };
};

export const deleteReminder: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  await ownedReminder(id, req.user_id);
  await prisma.reminders.delete({ where: { id } });
  return { status: 204 };
};
