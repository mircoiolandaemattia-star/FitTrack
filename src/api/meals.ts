import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "./errors";
import type { Handler } from "./types";
import { dateSchema, idSchema, parse } from "./validate";

const idParam = z.object({ id: idSchema });

/**
 * Filtro obbligatorio: un giorno preciso (`date`) oppure un intervallo
 * (`from`/`to`, estremi inclusi). Niente liste "di tutti i pasti".
 */
const listQuery = z
  .object({
    date: dateSchema.optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
  })
  .refine(
    (query) =>
      query.date !== undefined || query.from !== undefined || query.to !== undefined,
    { message: "Filtro obbligatorio: 'date' oppure 'from'/'to'." },
  )
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: "'from' non può essere successivo di 'to'.",
  });

// `user_id` non è un campo dell'input: arriva dal JWT (req.user_id)
const createBody = z.object({
  diet_plan_id: idSchema.optional(),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  date: dateSchema,
  name: z.string().trim().min(1).max(200).optional(),
});

const updateBody = z.object({
  diet_plan_id: idSchema.optional(),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
  date: dateSchema.optional(),
  name: z.string().trim().min(1).max(200).optional(),
});

/** Piano di dieta opzionale: altrui -> 404, inesistente -> 422 (P2003). */
async function assertDietPlanUsable(dietPlanId: string | undefined, userId: string) {
  if (!dietPlanId) return;
  const plan = await prisma.diet_plans.findUnique({ where: { id: dietPlanId } });
  if (plan && plan.user_id !== userId) {
    throw HttpError.notFound("diet_plan", dietPlanId);
  }
}

/** Pasto visibile solo se dell'utente del token. */
async function ownedMeal(id: string, userId: string) {
  const meal = await prisma.meals.findFirst({ where: { id, user_id: userId } });
  if (!meal) throw HttpError.notFound("meal", id);
  return meal;
}

export const listMeals: Handler = async (req) => {
  const { date, from, to } = parse(listQuery, req.query);
  // `date` = un solo giorno; altrimenti intervallo con estremi inclusi
  const dateFilter =
    date !== undefined
      ? new Date(date)
      : {
          ...(from !== undefined ? { gte: new Date(from) } : {}),
          ...(to !== undefined ? { lte: new Date(to) } : {}),
        };
  const meals = await prisma.meals.findMany({
    where: { user_id: req.user_id, date: dateFilter },
    orderBy: [{ date: "asc" }, { created_at: "asc" }],
  });
  return { status: 200, body: meals };
};

export const createMeal: Handler = async (req) => {
  const data = parse(createBody, req.body);
  await assertDietPlanUsable(data.diet_plan_id, req.user_id);
  const meal = await prisma.meals.create({
    data: { ...data, date: new Date(data.date), user_id: req.user_id },
  });
  return { status: 201, body: meal };
};

export const getMeal: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  return { status: 200, body: await ownedMeal(id, req.user_id) };
};

export const updateMeal: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  const data = parse(updateBody, req.body);
  if (Object.keys(data).length === 0) {
    throw HttpError.badRequest("Il corpo deve contenere almeno un campo da aggiornare.");
  }
  await ownedMeal(id, req.user_id);
  await assertDietPlanUsable(data.diet_plan_id, req.user_id);
  const meal = await prisma.meals.update({
    where: { id },
    data: { ...data, ...(data.date !== undefined ? { date: new Date(data.date) } : {}) },
  });
  return { status: 200, body: meal };
};

export const deleteMeal: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  await ownedMeal(id, req.user_id);
  // Cascata su food_items (vincolo a livello DB)
  await prisma.meals.delete({ where: { id } });
  return { status: 204 };
};
