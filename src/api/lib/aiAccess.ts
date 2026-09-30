import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../errors";

/**
 * Accesso alle funzioni AI: abbonamento, quota giornaliera e log degli usi.
 *
 * Il gating **non** si affida a nessun valore cacheato lato client: ad ogni
 * richiesta si rilegge `users.subscription_status` (aggiornabile a mano da
 * Supabase Studio, nessun sistema di pagamento qui). Il log è scritto solo
 * da queste funzioni, dopo che la chiamata AI è effettivamente riuscita.
 */

/** Feature tracciate: corrisponde esattamente ad `ai_usage_log.feature`. */
export const AI_FEATURES = [
  "photo_meal",
  "workout_generation",
  "diet_generation",
  "file_upload",
] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

/** Enum zod condiviso da `aiUsageLog` e dagli endpoint `/api/ai/*`. */
export const aiFeatureSchema = z.enum(AI_FEATURES);

/** Limite giornaliero della foto pasto per il piano free. */
export const FREE_PHOTO_LIMIT = 2;

/**
 * Abbonamento dell'utente **letto ad ogni richiesta** dalla tabella users.
 * Utente senza riga profilo o con valore inatteso = free (comportamento
 * permissivo solo sul piano base: niente premium "per errore").
 */
export async function subscriptionStatus(userId: string): Promise<"free" | "premium"> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { subscription_status: true },
  });
  return user?.subscription_status === "premium" ? "premium" : "free";
}

/** 403 `PREMIUM_REQUIRED` se l'utente non è premium. */
export async function assertPremium(userId: string): Promise<void> {
  if ((await subscriptionStatus(userId)) !== "premium") {
    throw new HttpError(
      403,
      "PREMIUM_REQUIRED",
      "Funzione riservata al piano premium.",
    );
  }
}

/**
 * Conta gli usi di oggi (giornata locale del server, da mezzanotte) per
 * una feature: stessa definizione di `GET /api/ai-usage-log/today`, così
 * il controllo quota e l'endpoint pubblico non possono divergere.
 */
export async function countUsageToday(userId: string, feature: AiFeature): Promise<number> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfNextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return prisma.ai_usage_log.count({
    where: {
      user_id: userId,
      feature,
      used_at: { gte: startOfDay, lt: startOfNextDay },
    },
  });
}

/**
 * 403 `DAILY_LIMIT_REACHED` se la quota giornaliera è già esaurita:
 * da chiamare **prima** di Gemini e solo per gli utenti free (il premium
 * non ha limiti, decide il chiamante).
 *
 * @returns usi di oggi (0, 1, … finché non si raggiunge il limite).
 */
export async function assertDailyQuota(
  userId: string,
  feature: AiFeature,
  limit: number,
): Promise<number> {
  const used = await countUsageToday(userId, feature);
  if (used >= limit) {
    throw new HttpError(
      403,
      "DAILY_LIMIT_REACHED",
      `Limite giornaliero raggiunto: ${used}/${limit} utilizzi oggi. Riprova domani.`,
      { feature, limit, used },
    );
  }
  return used;
}

/**
 * Registra l'uso di una feature AI. Va chiamata **solo dopo** un esito
 * felice (risposta Gemini valida o piano salvato): una chiamata fallita
 * non deve consumare la quota dell'utente.
 */
export async function recordAiUsage(userId: string, feature: AiFeature): Promise<void> {
  await prisma.ai_usage_log.create({
    data: { user_id: userId, feature },
    // used_at ha il default now() a livello DB
  });
}
