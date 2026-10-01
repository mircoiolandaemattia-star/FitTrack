import { router } from "expo-router";
import { getItem, removeItem, setItem } from "./storage";
import { supabase } from "./supabase";

const TOKEN_KEY = "fittrack_token";
const USER_KEY = "fittrack_user";

/**
 * URL di base dell'API.
 * In sviluppo punta a localhost; in produzione si imposta
 * EXPO_PUBLIC_API_URL nel file .env (vedi .env.example).
 */
export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api";

export class ApiError extends Error {
  readonly status: number;
  /** `code` dell'envelope di errore del backend (es. NOT_FOUND, P2002). */
  readonly code: string;
  /** Eventuali dettagli di validizzazione restituiti dall'API. */
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Type guard: true se l'errore viene dall'API (non da rete/serializzazione). */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Converte una risposta non-2xx in `ApiError`.
 * L'API risponde sempre `{"error": {"code", "message", "details?"}}`:
 * se il body non rispetta l'envelope (HTML di un proxy, testo grezzo…)
 * si conserva il testo come messaggio e si sintetizza un codice HTTP_500.
 */
async function toApiError(response: Response): Promise<ApiError> {
  const fallbackCode = `HTTP_${response.status}`;
  const raw = await response.text().catch(() => "");
  if (!raw) {
    return new ApiError(response.status, fallbackCode, `Errore ${response.status}`);
  }
  try {
    const parsed = JSON.parse(raw) as {
      error?: { code?: unknown; message?: unknown; details?: unknown };
    };
    const envelope = parsed?.error;
    if (envelope && typeof envelope.message === "string") {
      return new ApiError(
        response.status,
        typeof envelope.code === "string" ? envelope.code : fallbackCode,
        envelope.message,
        envelope.details,
      );
    }
  } catch {
    // Body non JSON: si procede con il testo grezzo.
  }
  return new ApiError(response.status, fallbackCode, raw);
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Sessione scaduta, effettua di nuovo il login.");
    this.name = "UnauthorizedError";
  }
}

type ApiOptions = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
  /** Timeout della singola richiesta (default: vedi `DEFAULT_TIMEOUT_MS`). */
  timeoutMs?: number;
};

/**
 * Timeout predefinito: il backend su Render free si addormenta e al
 * risveglio impiega ~60 secondi, quindi una richiesta deve poter
 * aspettare quel tempo invece di restare appesa per sempre.
 * Le chiamate AI (Gemini) sono più lente e ne passano uno dedicato.
 */
const DEFAULT_TIMEOUT_MS = 60_000;
/** Tempo massimo per rigenerare l'access token prima di mollare. */
const REFRESH_TIMEOUT_MS = 20_000;

/** `fetch` con scadenza: al termine la richiesta viene annullata. */
function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

type RefreshOutcome =
  | { status: "ok"; token: string }
  | { status: "dead" }
  | { status: "network" };

/**
 * Un 401 non è quasi mai una sessione da cancellare: il token in AsyncStorage
 * può essere semplicemente scaduto (es. app in riposo tutta la notte, oppure
 * scansione partita dopo più di un'ora di utilizzo). Prima si prova a
 * rigenerare l'access token; solo GoTrue che rifiuta il refresh (4xx) significa
 * che la sessione è davvero finita. Rete assente o 5xx non sloggiano nessuno.
 */
async function refreshAccessToken(): Promise<RefreshOutcome> {
  try {
    const { data, error } = await withTimeout(supabase.auth.refreshSession(), REFRESH_TIMEOUT_MS);
    if (data.session?.access_token) {
      const token = data.session.access_token;
      // Anche se l'evento di Supabase arriva dopo, lo storage è già allineato.
      await setItem(TOKEN_KEY, token).catch(() => undefined);
      return { status: "ok", token };
    }
    if (error) {
      const status = "status" in error ? error.status : undefined;
      if (typeof status === "number" && status >= 400 && status < 500) return { status: "dead" };
      if (error.name === "AuthSessionMissingError") return { status: "dead" };
      return { status: "network" };
    }
    return { status: "dead" };
  } catch {
    return { status: "network" };
  }
}

/** Chiude la sessione in locale, senza chiamate di rete. */
async function endSessionLocally(): Promise<void> {
  await removeItem(TOKEN_KEY);
  await removeItem(USER_KEY);
  supabase.auth.signOut({ scope: "local" }).catch(() => {});
  router.replace("/(auth)/login");
}

/**
 * Client API centralizzato.
 * Aggiunge automaticamente il JWT (Authorization: Bearer) letto da
 * AsyncStorage, ha un timeout, e su un401 prova prima a rigenerare il
 * token: il logout con redirect al login avviene solo se Supabase
 * conferma che la sessione non esiste più.
 */
export async function apiFetch<T = unknown>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const token = await getItem(TOKEN_KEY);
  return requestWithToken<T>(endpoint, options, token, true);
}

async function requestWithToken<T = unknown>(
  endpoint: string,
  options: ApiOptions,
  token: string | null,
  allowRefresh: boolean,
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers: optionHeaders, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...optionHeaders,
  };

  const isFormData = fetchOptions.body instanceof FormData;
  if (fetchOptions.body !== undefined && !isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE}${endpoint}`, { ...fetchOptions, headers }, timeoutMs);
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
    // 5xx sintetico: i query di React Query lo ritentano come un intoppo
    // transitorio, com'è (il backend che si sta risvegliando).
    throw new ApiError(
      503,
      timedOut ? "TIMEOUT" : "NETWORK",
      timedOut
        ? "Il server non risponde: se è la prima richiesta può starriprendendo (fino a ~1 minuto), riprova."
        : "Connessione al server non riuscita: controlla la rete e riprova.",
    );
  }

  // 401 → prima si prova a rigenerare il token, poi (solo se Supabase
  // conferma) pulizia sessione e redirect al login.
  if (response.status === 401) {
    if (allowRefresh) {
      const refreshed = await refreshAccessToken();
      if (refreshed.status === "ok") {
        return requestWithToken<T>(endpoint, options, refreshed.token, false);
      }
      if (refreshed.status === "dead") {
        await endSessionLocally();
        throw new UnauthorizedError();
      }
      // Rete o Supabase irraggiungibile: la sessione resta, si segnala l'errore.
      throw new ApiError(503, "NETWORK", "Connessione al server non riuscita: riprova.");
    }
    // Token già rigenerato e il backend rifiuta lo stesso: è un problema
    // del server, non della sessione → nessun logout, solo l'errore.
    throw await toApiError(response);
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return (await response.text()) as unknown as T;
}

/** Helper comodi per i verbi HTTP di uso comune. */
export const api = {
  get: <T = unknown>(endpoint: string, options?: ApiOptions) =>
    apiFetch<T>(endpoint, { ...options, method: "GET" }),

  post: <T = unknown>(endpoint: string, body?: unknown, options?: ApiOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),

  put: <T = unknown>(endpoint: string, body?: unknown, options?: ApiOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),

  patch: <T = unknown>(endpoint: string, body?: unknown, options?: ApiOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),

  delete: <T = unknown>(endpoint: string, options?: ApiOptions) =>
    apiFetch<T>(endpoint, { ...options, method: "DELETE" }),
};