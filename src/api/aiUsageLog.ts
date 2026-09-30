import { z } from "zod";
import { prisma } from "../lib/prisma";
import { aiFeatureSchema, countUsageToday } from "./lib/aiAccess";
import type { Handler } from "./types";
import { parse } from "./validate";

// Feature e conteggio "di oggi" stanno in lib/aiAccess: sono le stesse che
// usano gli endpoint /api/ai/* per il gating, così non possono divergere.
const createBody = z.object({ feature: aiFeatureSchema });
const todayQuery = z.object({ feature: aiFeatureSchema });

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
 * e basta — decidere se bloccare spetta a chi chiama (`lib/aiAccess`).
 */
export const todayAiUsage: Handler = async (req) => {
  const { feature } = parse(todayQuery, req.query);
  const count = await countUsageToday(req.user_id, feature);
  return { status: 200, body: { feature, count } };
};
