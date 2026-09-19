import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight, Dumbbell, Moon } from "lucide-react-native";
import type { WorkoutDay } from "@/types";
import { Card } from "./Card";

type WorkoutTodayCardProps = {
  /** Giorno programmato per oggi; null se non c'è allenamento. */
  day: WorkoutDay | null;
};

/**
 * Card "Allenamento di oggi": mostra il giorno di scheda e il bottone
 * per iniziare la sessione, oppure lo stato di riposo.
 */
export function WorkoutTodayCard({ day }: WorkoutTodayCardProps) {
  const isRestDay = day === null || day.isRestDay;

  function handleStart() {
    if (!day || isRestDay) return;
    router.push({
      pathname: "/(tabs)/scheda/allenamento/[dayId]",
      params: { dayId: day.id },
    });
  }

  return (
    <Card>
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
          {isRestDay ? (
            <Moon size={22} color="#94A3B8" strokeWidth={2.2} />
          ) : (
            <Dumbbell size={22} color="#F97316" strokeWidth={2.2} />
          )}
        </View>
        <Text className="font-inter-semibold text-base text-foreground">Allenamento di oggi</Text>
      </View>

      {isRestDay ? (
        <View className="mt-4">
          <Text className="font-inter-bold text-xl text-foreground">Giorno di riposo</Text>
          <Text className="mt-1 font-sans text-sm leading-5 text-muted">
            Recupera e ricarica le energie: oggi non è previsto allenamento.
          </Text>
        </View>
      ) : (
        <View className="mt-4">
          <Text className="font-inter-bold text-xl text-foreground">{day.name}</Text>
          <Text className="mt-1 font-sans text-sm text-muted">
            {day.muscleGroups.join(" · ")}
          </Text>
          <Text className="mt-1 font-sans text-xs text-muted">
            {day.exercises.length} esercizi
          </Text>

          <Pressable
            onPress={handleStart}
            accessibilityRole="button"
            accessibilityLabel={`Inizia allenamento ${day.name}`}
            className="mt-4 flex-row items-center justify-center gap-1.5 rounded-xl bg-primary py-3.5 active:opacity-80 cursor-pointer"
          >
            <Text className="font-inter-bold text-base text-primary-foreground">
              Inizia allenamento
            </Text>
            <ChevronRight size={18} color="#0F172A" strokeWidth={2.5} />
          </Pressable>
        </View>
      )}
    </Card>
  );
}