import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "./errors";
import type { Handler } from "./types";
import { dateSchema, idSchema, parse, rangeQuerySchema } from "./validate";

const idParam = z.object({ id: idSchema });

// `user_id` non è un campo dell'input: arriva dal JWT (req.user_id)
const createBody = z.object({
  date: dateSchema,
  // Il caricamento reale su Supabase Storage arriva dopo: per ora è solo
  // una stringa non vuota (il client può passare già un URL firmato)
  photo_url: z.string().trim().min(1).max(2048),
});

/** Foto visibile solo se dell'utente del token. */
async function ownedProgressPhoto(id: string, userId: string) {
  const photo = await prisma.progress_photos.findFirst({
    where: { id, user_id: userId },
  });
  if (!photo) throw HttpError.notFound("progress_photo", id);
  return photo;
}

export const listProgressPhotos: Handler = async (req) => {
  const { from, to } = parse(rangeQuerySchema, req.query);
  // Range opzionale con estremi inclusi; senza parametri torna tutto
  const dateFilter =
    from !== undefined || to !== undefined
      ? {
          ...(from !== undefined ? { gte: new Date(from) } : {}),
          ...(to !== undefined ? { lte: new Date(to) } : {}),
        }
      : undefined;
  const photos = await prisma.progress_photos.findMany({
    where: { user_id: req.user_id, date: dateFilter },
    orderBy: { date: "desc" },
  });
  return { status: 200, body: photos };
};

export const createProgressPhoto: Handler = async (req) => {
  const data = parse(createBody, req.body);
  const photo = await prisma.progress_photos.create({
    data: { ...data, date: new Date(data.date), user_id: req.user_id },
  });
  return { status: 201, body: photo };
};

// Nessun GET/PUT by `:id`: la foto si recupera dalla lista filtrata
export const deleteProgressPhoto: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  await ownedProgressPhoto(id, req.user_id);
  await prisma.progress_photos.delete({ where: { id } });
  return { status: 204 };
};
