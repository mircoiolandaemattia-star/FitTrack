import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "./errors";
import type { Handler } from "./types";
import { idSchema, parse } from "./validate";

const idParam = z.object({ id: idSchema });

/** La lista è sempre riferita a un pasto (obbligatorio), utente dal token. */
const listQuery = z.object({ meal_id: idSchema });

// `user_id` non esiste qui: la proprietà arriva dal pasto -> utente
const createBody = z.object({
  meal_id: idSchema,
  name: z.string().trim().min(1).max(200),
  quantity_g: z.number().min(0).max(10000).optional(),
  calories: z.number().int().min(0).max(10000),
  protein_g: z.number().min(0).max(1000),
  carbs_g: z.number().min(0).max(1000),
  fat_g: z.number().min(0).max(1000),
  source: z.enum(["barcode", "photo", "manual", "upload"]),
  barcode: z.string().trim().min(1).max(64).optional(),
  photo_url: z.string().trim().min(1).max(2048).optional(),
});

// Stessi campi del create meno il genitore (un alimento non si sposta di
// pasto), tutti opzionali; il check qui sotto scarta il corpo vuoto.
const updateBody = createBody.omit({ meal_id: true }).partial();

/**
 * Proprietà a cascata: food_item -> meal -> user. 404 identico se la
 * risorsa non esiste o se appartiene a un altro utente (IDOR/BOLA).
 */
async function ownedFoodItem(id: string, userId: string) {
  const item = await prisma.food_items.findFirst({
    where: { id, meal: { user_id: userId } },
  });
  if (!item) throw HttpError.notFound("food_item", id);
  return item;
}

export const listFoodItems: Handler = async (req) => {
  const { meal_id } = parse(listQuery, req.query);
  const items = await prisma.food_items.findMany({
    // Filtro sul pasto + proprietà: un pasto altrui non torna mai righe
    where: { meal_id, meal: { user_id: req.user_id } },
    orderBy: { created_at: "asc" },
  });
  return { status: 200, body: items };
};

export const createFoodItem: Handler = async (req) => {
  const data = parse(createBody, req.body);
  // Il pasto deve appartenere all'utente; se non esiste affatto lo
  // lasciamo fallire su P2003 (422), stesso comportamento di meals.
  const meal = await prisma.meals.findUnique({ where: { id: data.meal_id } });
  if (meal && meal.user_id !== req.user_id) {
    throw HttpError.notFound("meal", data.meal_id);
  }
  const item = await prisma.food_items.create({ data });
  return { status: 201, body: item };
};

export const getFoodItem: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  return { status: 200, body: await ownedFoodItem(id, req.user_id) };
};

export const updateFoodItem: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  const data = parse(updateBody, req.body);
  if (Object.keys(data).length === 0) {
    throw HttpError.badRequest("Il corpo deve contenere almeno un campo da aggiornare.");
  }
  await ownedFoodItem(id, req.user_id);
  const item = await prisma.food_items.update({ where: { id }, data });
  return { status: 200, body: item };
};

export const deleteFoodItem: Handler = async (req) => {
  const { id } = parse(idParam, req.params);
  await ownedFoodItem(id, req.user_id);
  await prisma.food_items.delete({ where: { id } });
  return { status: 204 };
};
