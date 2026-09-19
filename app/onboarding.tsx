import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Rocket } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/lib/auth";

/**
 * Schermata segnaposto dell'onboarding: qui arriveranno obiettivi,
 * dati antropometrici e impostazioni iniziali.
 */
export default function OnboardingScreen() {
  const { completeOnboarding } = useAuth();

  async function handleContinue() {
    await completeOnboarding();
    router.replace("/(tabs)/home");
  }

  return (
    <Screen className="justify-between">
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <View className="h-20 w-20 items-center justify-center rounded-3xl bg-accent/15">
          <Rocket size={36} color="#22C55E" strokeWidth={2.2} />
        </View>
        <Text className="font-inter-bold text-4xl text-foreground">Benvenuto!</Text>
        <Text className="max-w-xs text-center font-sans text-base leading-6 text-muted">
          Configura obiettivi, peso e abitudini per iniziare a monitorare i tuoi progressi.
        </Text>
      </View>

      <View className="px-6 pb-8">
        <Pressable
          onPress={handleContinue}
          className="items-center rounded-xl bg-primary py-3.5 active:opacity-80"
        >
          <Text className="font-inter-bold text-base text-primary-foreground">Comincia</Text>
        </Pressable>
      </View>
    </Screen>
  );
}