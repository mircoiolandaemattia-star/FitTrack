import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { CheckCircle2, Mail } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { supabase } from "@/lib/supabase";

type Status = "checking" | "verified" | "no-session";

/**
 * Destinazione del link di conferma email (Site URL su Supabase:
 * `/email-verified`). Supabase verifica il token e rimanda qui con i
 * token di sessione nell'URL: il client li consuma all'avvio e questa
 * schermata mostra l'esito. Il guard di `_layout.tsx` la lascia stare —
 * è la pagina stessa a gestire il passaggio successivo.
 */
export default function EmailVerifiedScreen() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (mounted) setStatus(session ? "verified" : "no-session");
      })
      .catch(() => {
        if (mounted) setStatus("no-session");
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Screen className="justify-center">
      <View className="flex-1 items-center justify-center gap-6 px-6 py-6">
        {status === "checking" ? (
          <>
            <ActivityIndicator size="large" color="#F97316" />
            <Text className="text-center font-sans text-sm text-muted">
              Verifica in corso…
            </Text>
          </>
        ) : status === "verified" ? (
          <>
            <View className="h-20 w-20 items-center justify-center rounded-3xl bg-accent/15">
              <CheckCircle2 size={36} color="#22C55E" strokeWidth={2.2} />
            </View>
            <View className="gap-2">
              <Text className="text-center font-inter-bold text-3xl text-foreground">
                Email verificata!
              </Text>
              <Text className="text-center font-sans text-sm leading-5 text-muted">
                Il tuo account è attivo. Bentornato in FitTrack: puoi entrare.
              </Text>
            </View>
            <Pressable
              onPress={() => router.replace("/")}
              accessibilityRole="button"
              accessibilityLabel="Entra nell'app"
              className="w-full items-center rounded-xl bg-primary py-3.5 active:opacity-80 cursor-pointer"
            >
              <Text className="font-inter-bold text-base text-primary-foreground">
                Entra nell’app
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <View className="h-20 w-20 items-center justify-center rounded-3xl bg-primary/15">
              <Mail size={36} color="#F97316" strokeWidth={2.2} />
            </View>
            <View className="gap-2">
              <Text className="text-center font-inter-bold text-3xl text-foreground">
                Conferma ricevuta
              </Text>
              <Text className="text-center font-sans text-sm leading-5 text-muted">
                Se hai appena cliccato il link di conferma, il tuo account è
                attivo: accedi con le tue credenziali per continuare.
              </Text>
            </View>
            <Pressable
              onPress={() => router.replace("/(auth)/login")}
              accessibilityRole="button"
              accessibilityLabel="Vai al login"
              className="w-full items-center rounded-xl bg-primary py-3.5 active:opacity-80 cursor-pointer"
            >
              <Text className="font-inter-bold text-base text-primary-foreground">
                Vai al login
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </Screen>
  );
}
