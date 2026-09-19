import { ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, Dumbbell, ListChecks } from "lucide-react-native";
import { Pressable } from "react-native";
import { Card } from "@/components/home/Card";
import { mockWorkoutPlan } from "@/lib/mock-data";

/**
 * Dettaglio allenamento del giorno di scheda (segnaposto).
 * Verrà sviluppato con la lista serie/reps e il cronometro della sessione.
 */
export default function WorkoutDetailScreen() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const day = mockWorkoutPlan.days.find((d) => d.id === dayId);

  if (!day || day.isRestDay) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="font-inter-bold text-xl text-foreground">Allenamento non trovato</Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-4 items-center rounded-xl bg-primary px-6 py-3.5 active:opacity-80 cursor-pointer"
        >
          <Text className="font-inter-bold text-base text-primary-foreground">Indietro</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="gap-5 px-4 py-6">
        {/* Header */}
        <View className="flex-row items-center gap-4">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Torna indietro"
            hitSlop={8}
            className="h-11 w-11 items-center justify-center rounded-xl bg-surface active:opacity-80 cursor-pointer"
          >
            <ChevronLeft size={22} color="#F8FAFC" strokeWidth={2.2} />
          </Pressable>
          <View className="flex-1">
            <Text className="font-inter-bold text-2xl text-foreground">{day.name}</Text>
            <Text className="mt-0.5 font-sans text-sm text-muted">
              {day.muscleGroups.join(" · ")}
            </Text>
          </View>
        </View>

        {/* Riepilogo */}
        <Card>
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
              <Dumbbell size={22} color="#F97316" strokeWidth={2.2} />
            </View>
            <View>
              <Text className="font-inter-semibold text-base text-foreground">
                {day.exercises.length} esercizi
              </Text>
              <Text className="font-sans text-sm text-muted">
                {day.exercises.reduce((sum, ex) => sum + ex.sets * ex.reps, 0)} ripetizioni totali
              </Text>
            </View>
          </View>
        </Card>

        {/* Esercizi (segnaposto) */}
        <View className="gap-3">
          <View className="flex-row items-center gap-2">
            <ListChecks size={18} color="#F97316" strokeWidth={2.2} />
            <Text className="font-inter-semibold text-base text-foreground">Esercizi</Text>
          </View>
          {day.exercises.map((exercise) => (
            <Card key={exercise.id} className="p-4">
              <Text className="font-inter-semibold text-sm text-foreground">{exercise.name}</Text>
              <Text className="mt-1 font-sans text-xs text-muted">
                {exercise.sets} serie × {exercise.reps} rep
                {exercise.weightKg > 0 ? ` · ${exercise.weightKg} kg` : ""}
              </Text>
            </Card>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}