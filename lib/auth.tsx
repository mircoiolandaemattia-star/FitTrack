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
import type { User } from "@/types";

const TOKEN_KEY = "fittrack_token";
const USER_KEY = "fittrack_user";
const ONBOARDING_KEY = "fittrack_onboarding_done";

interface AuthContextValue {
  /** true finché non è stato ripristinato lo stato dal disco. */
  isLoading: boolean;
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  user: User | null;
  /** Login mock: nessuna chiamata di rete per ora. */
  login: (email: string, password: string) => Promise<User>;
  /** Registrazione mock. */
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  /** Aggiorna dati utente (mock, persiste su AsyncStorage). */
  updateUser: (patch: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  // Ripristino stato persistito all'avvio.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [storedToken, storedUser, onboarding] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
          AsyncStorage.getItem(ONBOARDING_KEY),
        ]);
        if (cancelled) return;
        setToken(storedToken);
        setUser(storedUser ? (JSON.parse(storedUser) as User) : null);
        setHasCompletedOnboarding(onboarding === "true");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistAuth = useCallback(async (nextToken: string, nextUser: User) => {
    await AsyncStorage.multiSet([
      [TOKEN_KEY, nextToken],
      [USER_KEY, JSON.stringify(nextUser)],
    ]);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  /** Login mock: salva un token fittizio e un profilo utente di prova. */
  const login = useCallback(
    async (email: string, _password: string) => {
      // TODO: sostituire con la chiamata reale a POST /auth/login quando il backend sarà pronto.
      await new Promise((resolve) => setTimeout(resolve, 400));
      const mockUser: User = {
        id: "mock-user-1",
        email,
        name: email.split("@")[0] || "Utente",
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
        createdAt: new Date().toISOString(),
      };
      const mockToken = `mock-jwt-token.${Date.now()}`;
      await persistAuth(mockToken, mockUser);
      return mockUser;
    },
    [persistAuth],
  );

  /** Registrazione mock. */
  const register = useCallback(
    async (name: string, email: string, _password: string) => {
      // TODO: sostituire con la chiamata reale a POST /auth/register.
      await new Promise((resolve) => setTimeout(resolve, 400));
      const mockUser: User = {
        id: "mock-user-1",
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
        createdAt: new Date().toISOString(),
      };
      const mockToken = `mock-jwt-token.${Date.now()}`;
      await persistAuth(mockToken, mockUser);
      return mockUser;
    },
    [persistAuth],
  );

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback(
    async (patch: Partial<User>) => {
      if (!user) return;
      const next = { ...user, ...patch } as User;
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(next));
      setUser(next);
    },
    [user],
  );

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    setHasCompletedOnboarding(true);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated: token !== null && user !== null,
      hasCompletedOnboarding,
      user,
      login,
      register,
      logout,
      completeOnboarding,
      updateUser,
    }),
    [isLoading, token, user, hasCompletedOnboarding, login, register, logout, completeOnboarding, updateUser],
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