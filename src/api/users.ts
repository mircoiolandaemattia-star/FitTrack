import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "./errors";
import { type NutritionalTargets, computeTargets } from "./lib/tdee";
import type { Handler } from "./types";
import { parse } from "./validate";

const genderSchema = z.enum(["male", "female", "other"]);
const goalSchema = z.enum(["lose", "maintain", "gain"]);
const activityLevelSchema = z.enum(["sedentary", "light", "moderate", "active", "very_active"]);

/** Data di nascita "YYYY-MM-DD", non futura (l'età del TDEE si calcola da qui). */
const birthDateSchema = z.iso.date().refine((value) => value <= todayIso(), {
  message: "birth_date non può essere nel futuro.",
});

const heightCmSchema = z.number().min(50).max(300);
const weightKgSchema = z.number().min(20).max(500);

/**
 * Il profilo ha una riga sola per utente: non esistono `:id`, l'identità
 * (`id`, `email`) arriva solo dal token e il body contiene solo dati del
 * profilo.
 */
const createBody = z.object({
  name: z.string().trim().min(1).max(200),
  birth_date: birthDateSchema,
  gender: genderSchema,
  height_cm: heightCmSchema,
  weight_kg: weightKgSchema,
  goal: goalSchema,
  activity_level: activityLevelSchema,
});

const updateBody = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  birth_date: birthDateSchema.optional(),
  gender: genderSchema.optional(),
  height_cm: heightCmSchema.optional(),
  weight_kg: weightKgSchema.optional(),
  goal: goalSchema.optional(),
  activity_level: activityLevelSchema.optional(),
});

/** Campi che entrano nella formula TDEE: se uno è nell'input, ricalcolo. */
const TDEE_FIELDS = [
  "birth_date",
  "gender",
  "height_cm",
  "weight_kg",
  "goal",
  "activity_level",
] as const;

const PROFILE_MISSING =
  "Profilo inesistente: onboarding non completato.";

function todayIso(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export const createUser: Handler = async (req) => {
  const data = parse(createBody, req.body);
  if (!req.email) {
    // Il token è valido ma senza claim email: non è un problema di firma,
    // è un input inutilizzabile per creare la riga (users.email NOT NULL).
    throw new HttpError(
      400,
      "EMAIL_MISSING",
      "Il token non contiene il claim email: impossibile creare il profilo.",
    );
  }
  // Onboarding una tantum: la riga nasce qui, non esiste un altro modo di
  // crearla, quindi un profilo già presente significa "onboarding rifatto".
  const existing = await prisma.users.findUnique({ where: { id: req.user_id } });
  if (existing) {
    throw new HttpError(409, "CONFLICT", "Profilo già esistente: l'onboarding non si rifà due volte.");
  }

  const birthDate = new Date(data.birth_date);
  const profile = await prisma.users.create({
    data: {
      // Identità dal token, mai dal body
      id: req.user_id,
      email: req.email,
      name: data.name,
      birth_date: birthDate,
      gender: data.gender,
      height_cm: data.height_cm,
      weight_kg: data.weight_kg,
      goal: data.goal,
      activity_level: data.activity_level,
      ...computeTargets({
        birthDate,
        gender: data.gender,
        heightCm: data.height_cm,
        weightKg: data.weight_kg,
        goal: data.goal,
        activityLevel: data.activity_level,
      }),
    },
  });
  return { status: 201, body: profile };
};

export const getMe: Handler = async (req) => {
  const profile = await prisma.users.findUnique({ where: { id: req.user_id } });
  if (!profile) throw new HttpError(404, "NOT_FOUND", PROFILE_MISSING);
  return { status: 200, body: profile };
};

export const updateMe: Handler = async (req) => {
  const data = parse(updateBody, req.body);
  if (Object.keys(data).length === 0) {
    throw HttpError.badRequest("Il corpo deve contenere almeno un campo da aggiornare.");
  }
  const current = await prisma.users.findUnique({ where: { id: req.user_id } });
  if (!current) throw new HttpError(404, "NOT_FOUND", PROFILE_MISSING);

  const next = {
    name: data.name ?? current.name,
    birth_date: data.birth_date !== undefined ? new Date(data.birth_date) : current.birth_date,
    gender: data.gender ?? current.gender,
    height_cm: data.height_cm ?? current.height_cm,
    weight_kg: data.weight_kg ?? current.weight_kg,
    goal: data.goal ?? current.goal,
    activity_level: data.activity_level ?? current.activity_level,
  };

  // Ricalcolo solo se tra i campi inviati ce n'è uno che entra nella
  // formula: stessa funzione del POST, zero duplicazione.
  let targets: NutritionalTargets | undefined;
  if (TDEE_FIELDS.some((field) => field in data)) {
    if (!next.birth_date || next.height_cm === null || next.weight_kg === null) {
      throw HttpError.badRequest(
        "Dati incompleti per il ricalcolo TDEE: servono birth_date, height_cm e weight_kg.",
      );
    }
    targets = computeTargets({
      birthDate: next.birth_date,
      gender: next.gender,
      heightCm: next.height_cm,
      weightKg: next.weight_kg,
      goal: next.goal,
      activityLevel: next.activity_level,
    });
  }

  const profile = await prisma.users.update({
    where: { id: req.user_id },
    data: { ...next, ...targets },
  });
  return { status: 200, body: profile };
};
