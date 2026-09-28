import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Fail-fast come lato server: senza URL e chiave l'app non avrebbe un'auth
// reale e ogni chiamata al backend finirebbe in 401 silenzioso.
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Mancano EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY nel file .env (vedi .env.example).",
  );
}

/**
 * `window` esiste solo nel browser: durante il render statico di Expo Router
 * (web/SSR) il client va costruito senza sessione persistita e senza accessi
 * a localStorage, altrimenti lo shell HTML esplode con "window is not defined".
 */
const isServer = typeof window === "undefined";

const authStorage = {
  getItem: (key: string) => (isServer ? Promise.resolve(null) : AsyncStorage.getItem(key)),
  setItem: (key: string, value: string) =>
    isServer ? Promise.resolve() : AsyncStorage.setItem(key, value),
  removeItem: (key: string) => (isServer ? Promise.resolve() : AsyncStorage.removeItem(key)),
};

/**
 * Client Supabase Auth: l'unica fonte dei token Bearer che il backend
 * (e lib/api.ts) accettano. La sessione persiste su AsyncStorage, così
 * all'avvio l'app riprende già autenticata.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: authStorage,
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    // Nessun OAuth/web: niente parsing della query string.
    detectSessionInUrl: false,
  },
});
