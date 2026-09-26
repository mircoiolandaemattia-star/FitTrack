/**
 * Contratto fra i handler puri di `src/api` e il layer Express di
 * `src/server`. Nessuno di questi tipi (e nessun file di `src/api`)
 * importa Express: i test possono chiamare gli handler con oggetti
 * letterali, senza passare da un server HTTP.
 */

export interface ApiRequest {
  /**
   * Utente autenticato: claim `sub` del JWT Supabase verificato dal
   * middleware `requireAuth`. Non arriva mai dal client (né query né
   * body): è l'unico identificativo di cui fidarsi.
   */
  user_id: string;
  /**
   * Claim `email` del JWT Supabase (opzionale: non tutti i token lo
   * contengono, es. auth via telefono). Alimenta `users.email` (NOT NULL):
   * come `user_id` è identità ed arriva solo dal token, mai dal body.
   */
  email?: string;
  /** Path params estratti da Express (`/api/workout-plans/:id` → `{ id }`). */
  params: Record<string, string>;
  /** Query string non validata: la validazione spetta all'handler (zod). */
  query: Record<string, unknown>;
  /** Body JSON (`undefined` se assente o non parsato). Idem: validato dall'handler. */
  body: unknown;
}

export interface ApiResponse {
  /** Status HTTP da restituire (200, 201, 204, ...). */
  status: number;
  /**
   * Payload: viene inviato così com'è come JSON.
   * `undefined` → nessun corpo (tipico per il 204).
   */
  body?: unknown;
}

/** Un handler puro: prende una richiesta, restituisce una risposta o lancia. */
export type Handler = (req: ApiRequest) => Promise<ApiResponse>;
