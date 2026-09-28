import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWorkoutPlan, useWorkoutPlans } from "@/lib/workoutQueries";
import { ActiveWorkoutSession } from "@/components/scheda/ActiveWorkoutSession";

/**
 * Allenamento attivo del giorno di scheda: il giorno arriva dal dettaglio
 * del piano attivo (giorni/esercizi annidati), non da dati locali.
 */
export default function WorkoutDetailScreen() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();

  const plansQuery = useWorkoutPlans();
  const plans = plansQuery.data ?? [];
  const activePlan = plans.find((plan) => plan.isActive) ?? plans[0] ?? null;
  const planQuery = useWorkoutPlan(activePlan?.id);

  const isLoading = plansQuery.isLoading || planQuery.isLoading;
  const hasError = plansQuery.isError || planQuery.isError;
  const day = planQuery.data?.days.find((candidate) => candidate.id === dayId) ?? null;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#F97316" />
      </View>
    );
  }

  if (hasError || !day || day.isRestDay) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="font-inter-bold text-xl text-foreground">
          {hasError ? "Impossibile caricare la scheda" : "Allenamento non trovato"}
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-4 cursor-pointer items-center rounded-xl bg-primary px-6 py-3.5 active:opacity-80"
        >
          <Text className="font-inter-bold text-base text-primary-foreground">Indietro</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ActiveWorkoutSession day={day} />
    </SafeAreaView>
  );
}
