import { z } from "zod";
import { HttpError } from "./errors";
import type { Handler } from "./types";
import { parse } from "./validate";

/**
 * Lookup di un prodotto per codice a barre su Open Food Facts.
 *
 * Il backend fa da proxy: la chiamata parte dal server così il PWA non
 * dipende dal CORS di Open Food Facts e il client non conosce l'API
 * esterna. La risposta contiene i valori **per 100 g** (come nella
 * tabella nutrizionale): è il client a moltiplicarli per i grammi che
 * l'utente dichiara di aver mangiato.
 *
 * Nessuna quota AI e nessun salvataggio: l'alimento nasce solo quando
 * l'utente conferma dal modal di Dieta (`POST /food-items`).
 */
const lookupQuery = z.object({
  barcode: z
    .string()
    .trim()
    .regex(/^\d{8,14}$/, "Codice a barre non valido: servono da 8 a 14 cifre."),
});

/** Base API: overridable così i test usano un mock locale. */
function apiBase(): string {
  return process.env.FOOD_FACTS_API_BASE ?? "https://world.openfoodfacts.org";
}

/** Timeout della chiamata esterna (overridabile nei test). */
function timeoutMs(): number {
  const parsed = Number(process.env.FOOD_FACTS_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8000;
}

export interface FoodLookupResult {
  barcode: string;
  name: string;
  brand: string | null;
  /** Base di riferimento: sempre 100 g (i campi sotto sono per 100 g). */
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  /** Porzione dichiarata dal produttore, in grammi, se presente. */
  serving_g: number | null;
  /** Avvertenze sui dati (es. valori nutrizionali mancanti). */
  notes: string | null;
}

/* --------------------------------- Cache ---------------------------------- */

/**
 * Cache in memoria per non martellare Open Food Facts: i dati di un
 * prodotto non cambiano nel tempo, 24 ore bastano e avanzano. `Map`
 * mantiene l'ordine di inserimento, quindi il pruno è il più vecchio.
 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map<string, { value: FoodLookupResult; at: number }>();

function cacheGet(barcode: string): FoodLookupResult | null {
  const entry = cache.get(barcode);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(barcode);
    return null;
  }
  return entry.value;
}

function cacheSet(barcode: string, value: FoodLookupResult): void {
  if (!cache.has(barcode) && cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(barcode, { value, at: Date.now() });
}

/* ------------------------------- Mappature -------------------------------- */

/** Numero OFF (a volte stringa, a volte assente) → valore con 1 decimale. */
function nutrient(raw: unknown, max: number): number {
  const value = typeof raw === "string" ? Number(raw.replace(",", ".")) : typeof raw === "number" ? raw : NaN;
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(Math.min(value, max) * 10) / 10;
}

/** kcal per 100 g: arrotondate a intero come nella tabella nutrizionale. */
function calories(raw: unknown): number {
  const value = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : NaN;
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(Math.min(value, 9000));
}

/** "500 g", "1 l", "33 cl" → grammi/ml dichiarati, se leggibili. */
function parseDeclaredQuantity(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const match = /(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|cl|hl)/i.exec(raw);
  if (!match) return null;
  const amount = Number(match[1].replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = match[2].toLowerCase();
  const grams =
    unit === "kg" ? amount * 1000 : unit === "g" ? amount : unit === "hl" ? amount * 100000 : unit === "cl" ? amount * 10 : amount;
  return Math.round(grams);
}

type OffResponse = {
  status?: number;
  product?: {
    product_name?: unknown;
    product_name_it?: unknown;
    generic_name?: unknown;
    brands?: unknown;
    quantity?: unknown;
    serving_quantity?: unknown;
    nutriments?: Record<string, unknown>;
  };
};

/** Converte il prodotto OFF nella forma che il modal di Dieta si aspetta. */
function mapProduct(barcode: string, product: NonNullable<OffResponse["product"]>): FoodLookupResult {
  const nutriments = product.nutriments ?? {};
  const name =
    [product.product_name_it, product.product_name, product.generic_name]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .find(Boolean) ?? `Prodotto ${barcode}`;
  const kcal = calories(nutriments["energy-kcal_100g"] ?? nutriments["energy_100g"]);
  // Porzione dichiarata in grammi: `serving_quantity` è già numerica,
  // in alternativa si legge la confezione ("500 g", "1 l" → 500/1000 g).
  const serving = Math.round(Number(product.serving_quantity)) || parseDeclaredQuantity(product.quantity);

  return {
    barcode,
    name: name.slice(0, 120),
    brand: typeof product.brands === "string" && product.brands.trim() ? product.brands.trim().slice(0, 60) : null,
    quantity_g: 100,
    calories: kcal,
    protein_g: nutrient(nutriments["proteins_100g"], 100),
    carbs_g: nutrient(nutriments["carbohydrates_100g"], 100),
    fat_g: nutrient(nutriments["fat_100g"], 100),
    serving_g: serving && serving > 0 ? serving : null,
    notes: kcal === 0 ? "Valori nutrizionali assenti in Open Food Facts: controlla e correggi a mano." : null,
  };
}

/* -------------------------------- Handler --------------------------------- */

export const lookupFood: Handler = async (req) => {
  const { barcode } = parse(lookupQuery, req.query);

  const cached = cacheGet(barcode);
  if (cached) return { status: 200, body: cached };

  const url = `${apiBase()}/api/v2/product/${barcode}.json?fields=product_name,product_name_it,generic_name,brands,quantity,serving_quantity,nutriments`;

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs()) });
  } catch (error) {
    // Timeout o rete assente: è il servizio esterno a non rispondere.
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new HttpError(
      502,
      "FOOD_FACTS_UNAVAILABLE",
      timedOut
        ? "Open Food Facts non risponde: riprova tra qualche istante."
        : "Impossibile contattare Open Food Facts: controlla la connessione.",
    );
  }

  let payload: OffResponse | null = null;
  try {
    payload = (await response.json()) as OffResponse;
  } catch {
    payload = null;
  }

  const product = payload?.product;
  if (!response.ok || payload?.status !== 1 || !product) {
    // "Non trovato": 404 esterno oppure status 0 nel body (entrambi li usa
    // OFF). Qualsiasi altra risposta è un problema del servizio terzo.
    if (response.status === 404 || payload?.status === 0) {
      throw new HttpError(
        404,
        "PRODUCT_NOT_FOUND",
        "Prodotto non trovato in Open Food Facts: puoi inserirlo manualmente.",
      );
    }
    throw new HttpError(
      502,
      "FOOD_FACTS_UNAVAILABLE",
      `Open Food Facts ha risposto con un errore (HTTP ${response.status}).`,
    );
  }

  const result = mapProduct(barcode, product);
  cacheSet(barcode, result);
  return { status: 200, body: result };
};
