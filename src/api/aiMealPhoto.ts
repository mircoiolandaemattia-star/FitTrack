import { z } from "zod";
import {
  FREE_PHOTO_LIMIT,
  assertDailyQuota,
  recordAiUsage,
  subscriptionStatus,
} from "./lib/aiAccess";
import { aiMealPhotoSchema } from "./lib/aiSchemas";
import { generateGemini } from "./lib/gemini";
import type { Handler } from "./types";
import { parse } from "./validate";

/**
 * Foto pasto + descrizione libera → stima degli alimenti.
 *
 * Accesso: free **e** premium, ma il free è limitato a `FREE_PHOTO_LIMIT`
 * foto al giorno. L'ordine è obbligatorio:
 *   1. quota (solo per free, prima di Gemini: una chiamata che non parte
 *      non spreca né quota utente né token Google),
 *   2. chiamata Gemini,
 *   3. log dell'uso **solo** se Gemini ha risposto correttamente.
 *
 * La risposta non salva nulla: è una bozza da mostrare in conferma
 * (l'inserimento nel diario resta `POST /food-items` del client).
 */
const createBody = z.object({
  /** Immagine base64 (con o senza prefisso `data:...;base64,`). */
  photo: z.string().min(1).max(8_000_000),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
  /** Cosa ha mangiato l'utente, a supporto della foto. */
  description: z.string().trim().max(600).default(""),
});

const SYSTEM =
  "Sei un nutrizionista sportivo. Analizzi foto di pasti e ne stimi gli " +
  "alimenti e le quantità in grammi, con valori nutrizionali realistici " +
  "per porzione. Rispondi esclusivamente con JSON valido, senza testo fuori " +
  "dal JSON e senza markdown.";

const PROMPT_FORMAT =
  'Rispondi SOLO con questo JSON: {"items":[{"name":"Petto di pollo", ' +
  '"quantity_g":150,"calories":248,"protein_g":46,"carbs_g":0,"fat_g":5}], ' +
  '"notes":"stima indicativa"} — name è l\'alimento singolo, quantity_g la ' +
  "quantità stimata in grammi, calories sono kcal totali (non per 100g) e " +
  "le macro sono grammi totali. Se non riconosci alcun alimento, items è un array vuoto.";

/** Rimuove un eventuale prefisso `data:image/jpeg;base64,`. */
function toBase64(raw: string): string {
  const comma = raw.indexOf(",");
  return raw.startsWith("data:") && comma > 0 ? raw.slice(comma + 1) : raw;
}

export const analyzeMealPhoto: Handler = async (req) => {
  const data = parse(createBody, req.body);

  // 1. Accesso + quota: il premium non ha limiti, il free sì.
  const isFree = (await subscriptionStatus(req.user_id)) === "free";
  const usedToday = isFree
    ? await assertDailyQuota(req.user_id, "photo_meal", FREE_PHOTO_LIMIT)
    : 0;

  // 2. Gemini: gli errori (timeout, rate limit, risposta malformata)
  //    arrivano già tradotti in HttpError da lib/gemini.
  const analysis = await generateGemini({
    schema: aiMealPhotoSchema,
    system: SYSTEM,
    prompt:
      (data.description ? `Cosa dice l'utente: ${data.description}\n` : "") +
      "Analizza la foto del pasto.\n" +
      PROMPT_FORMAT,
    attachments: [{ mimeType: data.mime_type, data: toBase64(data.photo) }],
    temperature: 0.2,
  });

  // 3. Solo ora l'uso è reale: una chiamata fallita non consuma quota.
  await recordAiUsage(req.user_id, "photo_meal");

  return {
    status: 201,
    body: {
      items: analysis.items,
      notes: analysis.notes ?? null,
      // null = premium (illimitato); altrimenti quante ne restano oggi
      remaining_today: isFree ? FREE_PHOTO_LIMIT - usedToday - 1 : null,
    },
  };
};
