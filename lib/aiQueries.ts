import { useMutation } from "@tanstack/react-query";
import { api, isApiError } from "./api";

/**
 * Funzioni AI collegate al backend (`POST /api/ai/*`).
 *
 * Per ora in Dieta è collegata la sola analisi foto pasto: generazione
 * scheda, generazione dieta e lettura file restano stub finché non
 * validiamo questo primo flusso. La `GEMINI_API_KEY` vive solo sul server:
 * qui passa soltanto il contenuto (foto base64 + testo).
 */

/** Riga di stima di `POST /ai/meal-photo`: gli stessi campi di `food_items`. */
export interface AiFoodItem {
  name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MealPhotoResult {
  items: AiFoodItem[];
  /** Osservazioni del modello (es. "porzione stimata"), opzionale. */
  notes: string | null;
  /** Analisi rimaste oggi al piano free; `null` = premium, illimitato. */
  remaining_today: number | null;
}

export type AnalyzeMealPhotoInput = {
  /** Immagine base64 **senza** prefisso `data:...;base64,`. */
  photo: string;
  mimeType: string;
  /** Descrizione libera: cosa ha mangiato l'utente. */
  description: string;
};

/** Gli errori 4xx sono risposte, non intoppi: mai in retry. */
function noRetry(failureCount: number, error: unknown): boolean {
  return isApiError(error) ? error.status >= 500 && failureCount < 1 : failureCount < 2;
}

/** Analisi di una foto pasto → bozza di alimenti da confermare. */
export function useAnalyzeMealPhoto() {
  return useMutation({
    mutationFn: ({ photo, mimeType, description }: AnalyzeMealPhotoInput) =>
      api.post<MealPhotoResult>("/ai/meal-photo", {
        photo,
        mime_type: mimeType,
        description,
      }),
    retry: noRetry,
  });
}

/**
 * Messaggio leggibile per un errore delle funzioni AI: l'API restituisce
 * testo italiano già pronto (`DAILY_LIMIT_REACHED`, `PREMIUM_REQUIRED`,
 * `GEMINI_*`), qui si copre solo il caso di rete assente.
 */
export function aiErrorMessage(error: unknown): string {
  if (isApiError(error)) return error.message;
  return "Connessione al server non riuscita: riprova.";
}
