import { useMutation } from "@tanstack/react-query";
import { api, isApiError } from "./api";

/**
 * Lookup di un prodotto per codice a barre (`GET /api/food-items/lookup`).
 *
 * Il backend fa da proxy a Open Food Facts e restituisce i valori **per
 * 100 g**: sono il client e l'utente a decidere quanti grammi mangiare,
 * moltiplicando per la quantità indicata nel modal di Dieta.
 */

export interface BarcodeProduct {
  barcode: string;
  name: string;
  brand: string | null;
  /** Base di riferimento: 100 g. */
  quantity_g: number;
  /** Valori per 100 g. */
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  /** Porzione dichiarata dal produttore (grammi), se presente. */
  serving_g: number | null;
  /** Avvertenze sui dati (es. tabella nutrizionale assente). */
  notes: string | null;
}

/** Gli errori 4xx sono risposte, non intoppi: mai in retry. */
function noRetry(failureCount: number, error: unknown): boolean {
  return isApiError(error) ? error.status >= 500 && failureCount < 1 : failureCount < 2;
}

/** Ricerca per codice: nessun salvataggio, solo il prodotto trovato. */
export function useLookupBarcode() {
  return useMutation({
    mutationFn: (barcode: string) =>
      api.get<BarcodeProduct>(
        `/food-items/lookup?barcode=${encodeURIComponent(barcode.trim())}`,
      ),
    retry: noRetry,
  });
}

/** Messaggio leggibile: quello dell'API (già italiano) o una rete assente. */
export function foodLookupErrorMessage(error: unknown): string {
  if (isApiError(error)) return error.message;
  return "Connessione al server non riuscita: riprova.";
}
