import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User } from "@/types";
import { getJson, removeItem, setItem, setJson } from "./storage";
import { supabase } from "./supabase";

const TOKEN_KEY = "fittrack_token";
const USER_KEY = "fittrack_user";

interface AuthContextValue {
  /** true finché non è stato ripristinato lo stato dal disco. */
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  /** Login reale: Supabase Auth, access_token salvato in AsyncStorage. */
  login: (email: string, password: string) => Promise<User>;
  /** Registrazione reale: Supabase Auth (l'app non ha API di registro). */
  register: (name: string, email: string, password: string) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  /** Aggiorna il profilo locale (disclaimer, TDEE, …): non va a rete. */
  updateUser: (patch: Partial<User>) => Promise<void>;
}

/**
 * Esito della registrazione. Con la conferma email attiva Supabase crea
 * l'account ma non emette sessione: non è un errore, la schermata
 * "controlla la mail" ci arriva da qui.
 */
export type RegisterResult =
  | { status: "confirmed" }
  | { status: "confirmation_required" };

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Profilo locale minimo ricavato dall'account Supabase: i campi "di
 * servizio" (disclaimer, obiettivi…) restano locali finché l'onboarding
 * non scrive la riga profilo con POST /api/users.
 */
function userFromAuth(authUser: SupabaseUser): User {
  const email = authUser.email ?? "";
  const metaName = authUser.user_metadata?.name;
  const name = typeof metaName === "string" ? metaName : "";
  return {
    id: authUser.id,
    email,
    name: name.trim() || email.split("@")[0] || "Utente",
    isPremium: false,
    isTrial: false,
    trialEndsAt: null,
    goal: null,
    age: null,
    weightKg: null,
    heightCm: null,
    gender: null,
    activityLevel: null,
    dailyCalories: null,
    acceptedDisclaimer: false,
    createdAt: authUser.created_at ?? new Date().toISOString(),
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  /**
   * Ogni variazione di sessione viene riverata in AsyncStorage: è da lì
   * che lib/api.ts legge il Bearer, così refresh e logout restano
   * allineati senza che i componenti debbano sapere di Supabase.
   */
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setToken(session.access_token);
        setItem(TOKEN_KEY, session.access_token).catch(() => {});
        setUser((current) => current ?? userFromAuth(session.user));
      } else {
        setToken(null);
        removeItem(TOKEN_KEY).catch(() => {});
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Ripristino stato persistito all'avvio (sessione Supabase + profilo locale).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ data: { session } }, storedUser] = await Promise.all([
          supabase.auth.getSession(),
          getJson<User>(USER_KEY),
        ]);
        if (cancelled) return;
        if (session) {
          setToken(session.access_token);
          await setItem(TOKEN_KEY, session.access_token);
          // Il profilo locale si tiene solo se appartiene a questo account.
          setUser(
            storedUser && storedUser.id === session.user.id
              ? storedUser
              : userFromAuth(session.user),
          );
        } else {
          setToken(null);
          setUser(null);
        }
      } catch {
        // Disco/sessione illeggibili: si riparte non autenticati.
        setToken(null);
        setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Scrive il profilo locale dell'account appena autenticato. */
  const persistUser = useCallback(async (authUser: SupabaseUser): Promise<User> => {
    const stored = await getJson<User>(USER_KEY);
    const next = stored && stored.id === authUser.id ? stored : userFromAuth(authUser);
    await setJson(USER_KEY, next);
    setUser(next);
    return next;
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw new Error(error.message);
      return persistUser(data.user);
    },
    [persistUser],
  );

  const register = useCallback(
    async (name: string, email: string, password: string): Promise<RegisterResult> => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: name.trim() } },
      });
      if (error) throw new Error(error.message);
      // Conferma email attiva: l'account esiste, la sessione no.
      if (!data.session || !data.user) return { status: "confirmation_required" };
      await persistUser(data.user);
      return { status: "confirmed" };
    },
    [persistUser],
  );

  const logout = useCallback(async () => {
    // La sessione locale viene sempre rimossa (anche offline): la revoca
    // server non blocca il logout.
    await supabase.auth.signOut();
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback(
    async (patch: Partial<User>) => {
      if (!user) return;
      const next = { ...user, ...patch } as User;
      await setJson(USER_KEY, next);
      setUser(next);
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated: token !== null && user !== null,
      user,
      login,
      register,
      logout,
      updateUser,
    }),
    [isLoading, token, user, login, register, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve essere usato all'interno di <AuthProvider>");
  }
  return ctx;
}
