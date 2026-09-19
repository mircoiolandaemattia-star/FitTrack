import { router } from "expo-router";
import { getItem, removeItem } from "./storage";

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

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Sessione scaduta, effettua di nuovo il login.");
    this.name = "UnauthorizedError";
  }
}

type ApiOptions = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
};

/**
 * Client API centralizzato.
 * Aggiunge automaticamente il JWT (Authorization: Bearer) letto da
 * AsyncStorage, gestisce gli errori 401 (logout + redirect al login)
 * e restituisce il payload JSON deserializzato.
 */
export async function apiFetch<T = unknown>(
  endpoint: string,
  options: ApiOptions = {},
): Promise<T> {
  const token = await getItem(TOKEN_KEY);

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...options.headers,
  };

  const isFormData = options.body instanceof FormData;
  if (options.body !== undefined && !isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // 401 → token scaduto/invalido: pulizia sessione e redirect al login.
  if (response.status === 401) {
    await removeItem(TOKEN_KEY);
    await removeItem(USER_KEY);
    router.replace("/(auth)/login");
    throw new UnauthorizedError();
  }

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(response.status, body || `Errore ${response.status}`);
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