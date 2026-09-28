import { z } from "zod";
import { prisma } from "../lib/prisma";
import type { Handler } from "./types";
import { parse } from "./validate";

/** Feature AI tracciate: corrisponde esattamente ad `ai_usage_log.feature`. */
const featureSchema = z.enum([
  "photo_meal",
  "workout_generation",
  "diet_generation",
  "file_upload",
]);

const createBody = z.object({ feature: featureSchema });
const todayQuery = z.object({ feature: featureSchema });

/**
 * Registra l'uso di una funzione AI (chiamato dalle feature che la
 * consumano). Nessun PUT/DELETE: il log è in append, la riga non si
 * corregge e non si cancella.
 */
export const logAiUsage: Handler = async (req) => {
  const data = parse(createBody, req.body);
  const entry = await prisma.ai_usage_log.create({
    data: { user_id: req.user_id, feature: data.feature },
    // used_at ha il default now() a livello DB
  });
  return { status: 201, body: entry };
};

/**
 * Usi di oggi per una feature (giornata locale del server, da mezzanotte):
 * serve al piano free per il limite di 2 foto AI/giorno. Qui si **conta**
 * e basta — decidere se bloccare spetta a chi chiama.
 */
export const todayAiUsage: Handler = async (req) => {
  const { feature } = parse(todayQuery, req.query);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfNextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const count = await prisma.ai_usage_log.count({
    where: {
      user_id: req.user_id,
      feature,
      used_at: { gte: startOfDay, lt: startOfNextDay },
    },
  });
  return { status: 200, body: { feature, count } };
};
