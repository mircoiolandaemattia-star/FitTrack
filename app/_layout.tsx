import { useEffect } from "react";
import { Appearance } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { AuthProvider, useAuth } from "@/lib/auth";
import "../global.css";

// Tieni visibile lo splash finché font e stato auth non sono pronti.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // Il design system è dark-only: forza l'aspetto scuro anche se il
  // dispositivo è in modalità chiara (tab bar Liquid Glass, sfondi di
  // sistema, tastiera e contenitori nativi restano scuri).
  // Su web l'API non è implementata: guardia per non rompere il bundle.
  if (typeof Appearance.setColorScheme === "function") {
    Appearance.setColorScheme("dark");
  }

  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

function RootNavigator() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const { isLoading, isAuthenticated, hasCompletedOnboarding, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Guard di navigazione: login → onboarding (acceptedDisclaimer) → tab.
  useEffect(() => {
    if (isLoading || !fontsLoaded) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "onboarding";
    const needsOnboarding = !hasCompletedOnboarding || user?.acceptedDisclaimer === false;

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && needsOnboarding && !inOnboarding) {
      router.replace("/onboarding");
    } else if (isAuthenticated && !needsOnboarding && (inAuthGroup || inOnboarding)) {
      router.replace("/(tabs)/home");
    }
  }, [isLoading, fontsLoaded, isAuthenticated, hasCompletedOnboarding, user?.acceptedDisclaimer, segments, router]);

  // Nascondi lo splash solo quando tutto è pronto.
  useEffect(() => {
    if (!isLoading && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isLoading, fontsLoaded]);

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