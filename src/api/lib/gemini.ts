import { z } from "zod";
import { HttpError } from "../errors";

/**
 * Wrapper **unico** sull'API generativa di Google Gemini: ogni endpoint
 * `/api/ai/*` passa da qui, così autenticazione, timeout e traduzione degli
 * errori stanno in un solo posto.
 *
 * - La chiave (`GEMINI_API_KEY`) vive solo nel backend: non viene mai
 *   esposta al client (nessun `EXPO_PUBLIC_`, nessun refuso nel bundle).
 * - Tutti gli errori sono `HttpError`: l'adapter centralizzato di
 *   `errors.ts` li converte nella risposta HTTP senza codici sparsi.
 *
 * Codici restituiti:
 * - `GEMINI_NOT_CONFIGURED`  503  chiave assente sul server
 * - `GEMINI_TIMEOUT`         504  nessuna risposta entro il timeout
 * - `GEMINI_RATE_LIMITED`    429  quota/giorno esaurita da Google
 * - `GEMINI_AUTH_ERROR`      502  chiave rifiutata da Google
 * - `GEMINI_UNAVAILABLE`     502  rete/DNS/connessione a Google rotta
 * - `GEMINI_ERROR`           502  risposta HTTP non positiva da Google
 * - `GEMINI_BLOCKED`         502  richiesta bloccata dai filtri di Google
 * - `GEMINI_INVALID_RESPONSE`502  corpo non JSON, vuoto o non valido
 *
 * Affidabilità (l'API free tier dà spesso 503 "high demand" e Google
 * ritira i modelli vecchi con 404):
 * - su **503** si ritenta lo stesso modello `GEMINI_503_RETRIES` volte
 *   (default 1) con attesa `GEMINI_RETRY_DELAY_MS` crescente;
 * - su **404** (modello ritirato) o 503 esauriti i tentativi si passa al
 *   modello successivo della catena `GEMINI_MODEL` + `GEMINI_FALLBACK_MODELS`
 *   (default `gemini-3.5-flash-lite`; vuoto = nessun fallback);
 * - gli altri status (400/401/403/429/500) e i timeout/rete **non**
 *   cambiano modello: sono errori che riguardano la richiesta o la chiave,
 *   non il singolo modello, e ritentare aumenterebbe solo la latenza.
 */
// I nuovi progetti possono usare solo i modelli recenti (Google ha ritirato
// gemini-2.5-flash con 404 "no longer available to new users").
const DEFAULT_MODEL = "gemini-3.8-flash";
const DEFAULT_FALLBACK_MODELS = "gemini-3.5-flash-lite";
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_503_RETRIES = 1;
const DEFAULT_RETRY_DELAY_MS = 800;

export interface GeminiAttachment {
  /** MIME type dell'allegato (`image/jpeg`, `image/png`, `application/pdf`). */
  mimeType: string;
  /** Contenuto base64 **senza** il prefisso `data:...;base64,`. */
  data: string;
}

export interface GeminiRequest<T> {
  /** Domanda vera e propria (contiene anche le istruzioni di formato JSON). */
  prompt: string;
  /** Istruzioni di sistema: ruolo e regole generali (opzionale). */
  system?: string;
  /** Foto del pasto o PDF della scheda/dieta (opzionale). */
  attachments?: GeminiAttachment[];
  /**
   * Schema zod della risposta: se presente la risposta va trattata come JSON
   * (mime `application/json`) e viene validata qui, altrimenti torna testo.
   */
  schema?: z.ZodType<T>;
  /** Temperatura di campionamento (default del modello se omessa). */
  temperature?: number;
}

/** Interazione JSON restituita da Gemini: solo il testo della prima candidata. */
interface GenerateContentResponse {
  candidates?: {
    content?: { parts?: { text?: unknown }[] };
    finishReason?: unknown;
  }[];
  promptFeedback?: { blockReason?: unknown };
}

function envTimeoutMs(): number {
  const raw = Number(process.env.GEMINI_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

/** Numero di ritentativi extra su 503 per lo stesso modello (0 = nessuno). */
function env503Retries(): number {
  const raw = Number(process.env.GEMINI_503_RETRIES);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : DEFAULT_503_RETRIES;
}

/** Pausa base (ms) tra un tentativo e il successivo su 503. */
function envRetryDelayMs(): number {
  const raw = Number(process.env.GEMINI_RETRY_DELAY_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_RETRY_DELAY_MS;
}

/**
 * Catena di modelli da provare in ordine: primario (`GEMINI_MODEL`) più i
 * fallback (`GEMINI_FALLBACK_MODELS`, CSV). Fallback vuoto = solo primario.
 */
function modelChain(): string[] {
  const primary = (process.env.GEMINI_MODEL ?? "").trim() || DEFAULT_MODEL;
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS ?? DEFAULT_FALLBACK_MODELS)
    .split(",")
    .map((model) => model.trim())
    .filter((model) => model.length > 0 && model !== primary);
  return [primary, ...fallbacks];
}

/**
 * Testo utile (tracciato) di un body di errore Google, senza rumorosità.
 * `limit` più alto su 429: lì dentro (dopo "* Quota exceeded") stanno
 * metrica, limite e finestra, che con 300 chars venivano tagliati via.
 */
function snippet(text: string, limit = 300): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
}

/**
 * Il frammento di quota di un 429 di Google ("* Quota exceeded for quota
 * metric … with limit … per …"): è l'unica parte che dice quale limite è
 * stato colpito e quando si azzerra.
 */
function quotaExceeded(body: string): string | undefined {
  const at = body.indexOf("* Quota exceeded");
  if (at < 0) return undefined;
  return snippet(body.slice(at), 600);
}

/** Mappa lo status HTTP di Google su un `HttpError` con codice proprio. */
function googleStatusError(status: number, body: string, model: string): HttpError {
  const quota = status === 429 ? quotaExceeded(body) : undefined;
  const details = { googleStatus: status, model, body: snippet(body), ...(quota ? { quota } : {}) };
  if (status === 429) {
    // Il frammento di quota dice la finestra: con un limite giornaliero
    // "riprova tra qualche minuto" sarebbe un consiglio sbagliato.
    const daily = quota !== undefined && /\bday\b|giornalier/i.test(quota);
    return new HttpError(
      429,
      "GEMINI_RATE_LIMITED",
      daily
        ? "Limite giornaliero di Gemini raggiunto: riprova domani."
        : "Limite di richieste raggiunto su Gemini: riprova tra qualche minuto.",
      details,
    );
  }
  if (status === 401 || status === 403) {
    return new HttpError(
      502,
      "GEMINI_AUTH_ERROR",
      "Gemini ha rifiutato le credenziali del server (GEMINI_API_KEY non valida).",
      details,
    );
  }
  return new HttpError(
    502,
    "GEMINI_ERROR",
    `Gemini ha risposto con un errore (${status}).`,
    details,
  );
}

/** Testo concatenato delle parti di testo di una candidata. */
function candidateText(payload: GenerateContentResponse): string {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("");
}

/**
 * Unica porta d'ingresso alle chiamate Gemini.
 *
 * Costruisce il body (`contents` + eventuali allegati inline), poi prova la
 * catena di modelli: su 503 ritenta lo stesso modello (backoff lineare) e su
 * 404/503 esauriti passa al fallback. Ogni esito (rete, status Google, corpo
 * malformato) viene tradotto in `HttpError` e, se `schema` è presente, il
 * JSON generato viene validato. Gli endpoint non fanno altro che passare
 * prompt e schema.
 */
export async function generateGemini<T = string>(request: GeminiRequest<T>): Promise<T> {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new HttpError(
      503,
      "GEMINI_NOT_CONFIGURED",
      "Funzione AI non configurata: variabile GEMINI_API_KEY assente sul server.",
    );
  }

  const baseUrl = (process.env.GEMINI_API_BASE ?? "")
    .trim()
    .replace(/\/+$/, "") || "https://generativelanguage.googleapis.com";

  const parts: Record<string, unknown>[] = [{ text: request.prompt }];
  for (const attachment of request.attachments ?? []) {
    // Forma canonica (camelCase) della REST API di Google: `inlineData`
    // con `mimeType` + `data`, la stessa che usa il riferimento ufficiale.
    parts.push({
      inlineData: { mimeType: attachment.mimeType, data: attachment.data },
    });
  }

  const payload = {
    contents: [{ role: "user", parts }],
    ...(request.system
      ? { systemInstruction: { parts: [{ text: request.system }] } }
      : {}),
    generationConfig: {
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      // Chiede a Gemini JSON puro quando serve una struttura tipizzata
      ...(request.schema ? { responseMimeType: "application/json" } : {}),
    },
  };

  const timeoutMs = envTimeoutMs();
  const retries503 = env503Retries();
  const retryDelayMs = envRetryDelayMs();
  const chain = modelChain();
  // Budget complessivo: tutti i tentativi (retry + fallback) devono stare
  // entro GEMINI_TIMEOUT_MS, non un timeout per singolo tentativo.
  const deadline = Date.now() + timeoutMs;

  /** Un singolo POST su un dato modello: restituisce status + corpo. */
  const postToModel = async (model: string, budgetMs: number): Promise<{ status: number; raw: string }> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), budgetMs);
    try {
      const response = await fetch(`${baseUrl}/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      return { status: response.status, raw: await response.text() };
    } catch (error) {
      if (controller.signal.aborted) {
        throw new HttpError(
          504,
          "GEMINI_TIMEOUT",
          `Gemini non ha risposto entro ${timeoutMs} ms.`,
          { model },
        );
      }
      throw new HttpError(502, "GEMINI_UNAVAILABLE", "Servizio Gemini irraggiungibile.", {
        model,
        cause: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timer);
    }
  };

  let status = 0;
  let raw = "";
  let lastError: HttpError | undefined;

  // Catena dei modelli: 404 (ritirato) o 503 senza tentativi rimasti
  // passano al modello successivo; ogni altro errore è definitivo.
  for (let i = 0; i < chain.length; i += 1) {
    const model = chain[i];
    for (let attempt = 0; ; attempt += 1) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        throw lastError ??
          new HttpError(504, "GEMINI_TIMEOUT", `Gemini non ha risposto entro ${timeoutMs} ms.`, { model });
      }
      ({ status, raw } = await postToModel(model, remainingMs));

      if (status >= 200 && status < 300) break; // OK: esce dai tentativi

      const error = googleStatusError(status, raw, model);
      if (status === 429) throw error; // quota Google: cambiare modello non aiuta
      if (status !== 503 && status !== 404) throw error;

      // 503 "high demand" → ritenta lo stesso modello con backoff lineare
      const delayMs = retryDelayMs * (attempt + 1);
      if (status === 503 && attempt < retries503 && delayMs < deadline - Date.now()) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      lastError = error; // 404, o 503 esauriti: al prossimo modello
      break;
    }
    if (status >= 200 && status < 300) break;
    if (chain[i + 1] === undefined) throw lastError ?? googleStatusError(status, raw, chain[i]);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(
      502,
      "GEMINI_INVALID_RESPONSE",
      "Risposta di Gemini non interpretabile (JSON malformato).",
      { body: snippet(raw) },
    );
  }

  const content = (typeof parsed === "object" && parsed !== null
    ? parsed
    : {}) as GenerateContentResponse;

  const blockReason = content.promptFeedback?.blockReason;
  if (typeof blockReason === "string") {
    throw new HttpError(
      502,
      "GEMINI_BLOCKED",
      "Gemini ha bloccato la richiesta (filtri di sicurezza).",
      { blockReason },
    );
  }

  const text = candidateText(content).trim();
  if (!text) {
    throw new HttpError(
      502,
      "GEMINI_INVALID_RESPONSE",
      "Gemini ha restituito una risposta vuota.",
      { body: snippet(raw) },
    );
  }

  if (!request.schema) return text as unknown as T;

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // Gemini a volte avvolge il JSON in ```json … ```: si riprova senza i fence
    const unfenced = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try {
      json = JSON.parse(unfenced);
    } catch {
      throw new HttpError(
        502,
        "GEMINI_INVALID_RESPONSE",
        "Gemini non ha restituito JSON valido.",
        { body: snippet(text) },
      );
    }
  }

  const result = request.schema.safeParse(json);
  if (!result.success) {
    throw new HttpError(
      502,
      "GEMINI_INVALID_RESPONSE",
      "La risposta di Gemini non rispetta la struttura attesa.",
      {
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    );
  }
  return result.data;
}
