import { useEffect } from "react";
import { Appearance } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { isProfileMissing, useProfile } from "@/lib/profileQueries";
import { configureNotifications } from "@/lib/notifications";
import "../global.css";

// Tieni visibile lo splash finché font e stato auth non sono pronti.
SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Client unico per tutta l'app: ogni schermata usa useQuery/useMutation
 * invece di gestire loading ed errori a mano.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Un solo ritento automatico: poi la UI mostra l'errore con retry.
      retry: 1,
      // I dati restano validi 30s: navigare su e giù non rifà ogni volta.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
  },
});

export default function RootLayout() {
  // Il design system è dark-only: forza l'aspetto scuro anche se il
  // dispositivo è in modalità chiara (tab bar Liquid Glass, sfondi di
  // sistema, tastiera e contenitori nativi restano scuri).
  // Su web l'API non è implementata: guardia per non rompere il bundle.
  if (typeof Appearance.setColorScheme === "function") {
    Appearance.setColorScheme("dark");
  }

  // Handler delle notifiche: serve all'avvio perché i promemoria ricevuti
  // con l'app aperta vengano mostrati (senza handler il sistema li butta).
  useEffect(() => {
    void configureNotifications();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Senza questo bordo un errore di render in Release termina il
            processo (React → "uncaught" → reportFatal → abort) e a schermo
            non compare nulla: qui resta catturato e viene mostrato. */}
        <AppErrorBoundary>
          <RootNavigator />
        </AppErrorBoundary>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const { isLoading, isAuthenticated } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  /**
   * Profilo utente: è l'unica fonte di verità sull'onboarding.
   * 404 su GET /users/me → la riga non esiste ancora → onboarding.
   */
  const profileQuery = useProfile(isAuthenticated);
  // Solo se non c'è un profilo in cache: dopo il POST dell'onboarding la
  // cache è già aggiornata e il vecchio 404 non deve più rimandare lì.
  const profileMissing = isProfileMissing(profileQuery.error) && profileQuery.data === undefined;

  // Guard di navigazione: login → profilo (404 → onboarding) → tab.
  useEffect(() => {
    if (isLoading || !fontsLoaded) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "onboarding";
    // La destinazione del link di conferma gestisce il flusso da sola
    // (sessione dai token dell'URL → "Email verificata" → pulsanti).
    const inEmailVerified = segments[0] === "(auth)" && segments[1] === "email-verified";
    if (inEmailVerified) return;

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
      return;
    }
    if (!isAuthenticated) return;

    // In attesa del profilo non si decide niente (evita rimbalzi).
    if (!profileQuery.isFetched) return;

    if (profileMissing) {
      if (!inOnboarding) router.replace("/onboarding");
      return;
    }
    // Si torna alle tab solo con un profilo confermato dall'API.
    if (profileQuery.isSuccess && (inAuthGroup || inOnboarding)) {
      router.replace("/(tabs)/home");
    }
  }, [
    isLoading,
    fontsLoaded,
    isAuthenticated,
    profileQuery.isFetched,
    profileQuery.isSuccess,
    profileMissing,
    segments,
    router,
  ]);

  // Nascondi lo splash solo quando tutto è pronto (niente flash di Home
  // prima del redirect all'onboarding).
  useEffect(() => {
    const profileReady = !isAuthenticated || profileQuery.isFetched;
    if (!isLoading && fontsLoaded && profileReady) {
      SplashScreen.hideAsync();
    }
  }, [isLoading, fontsLoaded, isAuthenticated, profileQuery.isFetched]);

  if (isLoading || !fontsLoaded) {
    return null;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          // Sfondo scuro anche per i contenitori native-stack (niente bianco
          // durante le transizioni o se il contenuto non riempie la view).
          contentStyle: { backgroundColor: "#0F172A" },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/register" />
        <Stack.Screen name="onboarding" />
      </Stack>
    </>
  );
}
