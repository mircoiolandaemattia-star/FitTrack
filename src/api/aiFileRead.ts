import { z } from "zod";
import { assertPremium, recordAiUsage } from "./lib/aiAccess";
import { aiFileReadSchema, type AiFileReadResult } from "./lib/aiSchemas";
import { generateGemini } from "./lib/gemini";
import type { Handler } from "./types";
import { parse } from "./validate";

/**
 * Lettura di una scheda o di una dieta già esistente (foto o PDF).
 *
 * Gemini estrae la struttura — esercizi con serie/ripetizioni/peso oppure
 * pasti con alimenti — e **la restituisce senza salvare**: l'utente deve
 * poter controllare e correggere gli errori di lettura prima di confermare
 * (il salvataggio passa dai CRUD normali, `/workout-plans` o `/diet-plans`).
 *
 * Accesso: solo `users.subscription_status === "premium"` → 403
 * `PREMIUM_REQUIRED`. L'uso (feature `file_upload`) viene loggato solo
 * dopo una lettura riuscita.
 */
const createBody = z.object({
  /** File base64 (con o senza prefisso `data:...;base64,`). */
  file: z.string().min(1).max(8_000_000),
  mime_type: z
    .enum(["image/jpeg", "image/png", "image/webp", "application/pdf"])
    .default("image/jpeg"),
  /** Tipo di documento: "auto" lascia decidere a Gemini. */
  kind: z.enum(["auto", "workout", "diet"]).default("auto"),
});

const SYSTEM =
  "Sei un personal trainer e nutrizionista. Leggi schede di allenamento e " +
  "diete (anche fotografate o in PDF, incluse quelle scritte a mano) e ne " +
  "estrai la struttura in modo fedele: se un dato non è leggibile usa un " +
  "valore di default plausibile e segnalalo in notes. Rispondi " +
  "esclusivamente con JSON valido, senza testo fuori dal JSON e senza markdown.";

const WORKOUT_FORMAT =
  'Se è una SCHEDA rispondi: {"kind":"workout","workout":{"name":"Scheda A",' +
  '"days":[{"name":"Giorno A","exercises":[{"name":"Panca piana","sets":4,' +
  '"reps":8,"weight_kg":60,"rest_seconds":120,"notes":""}]}]},' +
  '"notes":"pesi non leggibili in due esercizi"}';

const DIET_FORMAT =
  'Se è una DIETA rispondi: {"kind":"diet","diet":{"name":"Dieta 2000",' +
  '"daily_calorie_target":2000,"protein_g":150,"carbs_g":220,"fat_g":65,' +
  '"meals":[{"meal_type":"lunch","name":"Pranzo","foods":[{"name":"Riso",' +
  '"quantity_g":100,"calories":360,"protein_g":7,"carbs_g":78,"fat_g":1}]}]},' +
  '"notes":""}';

export const readFile: Handler = async (req) => {
  const data = parse(createBody, req.body);

  // Gating premium: nessun valore arriva dal client, si legge il DB.
  await assertPremium(req.user_id);

  const kindHint =
    data.kind === "auto"
      ? "Il documento può essere una scheda o una dieta: riconosci tu il tipo."
      : data.kind === "workout"
        ? "Il documento è una scheda di allenamento."
        : "Il documento è una dieta alimentare.";

  const extracted: AiFileReadResult = await generateGemini({
    schema: aiFileReadSchema,
    system: SYSTEM,
    prompt:
      `${kindHint}\nEstrai la struttura completa mantenendo nomi, serie, ` +
      `ripetizioni e pesi (o alimenti e quantità) come scritti nel file.\n` +
      `${WORKOUT_FORMAT}\n${DIET_FORMAT}`,
    attachments: [{ mimeType: data.mime_type, data: data.file.replace(/^data:[^,]*,/, "") }],
    temperature: 0.1,
  });

  // Nessun salvataggio qui: la bozza torna al client per la conferma.
  await recordAiUsage(req.user_id, "file_upload");
  return { status: 201, body: extracted };
};
