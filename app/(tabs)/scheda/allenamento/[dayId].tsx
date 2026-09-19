import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getWorkoutPlan } from "@/lib/mock-data";
import { ActiveWorkoutSession } from "@/components/scheda/ActiveWorkoutSession";

/**
 * Allenamento attivo del giorno di scheda: wrapper del componente
 * ActiveWorkoutSession, raggiungibile dalla lista settimanale e dalla
 * card "Inizia allenamento" della Home.
 */
export default function WorkoutDetailScreen() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const day = getWorkoutPlan().days.find((d) => d.id === dayId);

  if (!day || day.isRestDay) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="font-inter-bold text-xl text-foreground">Allenamento non trovato</Text>
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