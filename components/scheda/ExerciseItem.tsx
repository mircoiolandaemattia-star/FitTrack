import { Text, View } from "react-native";
import type { Exercise } from "@/types";

type ExerciseItemProps = {
  exercise: Exercise;
  /** Mostra il numero d'ordine (1..n) a sinistra. */
  showOrder?: boolean;
};

/**
 * Riga di un singolo esercizio nella lista del giorno: nome,
 * serie × ripetizioni e peso consigliato.
 */
export function ExerciseItem({ exercise, showOrder = true }: ExerciseItemProps) {
  return (
    <View className="flex-row items-center gap-3 py-2.5">
      {showOrder ? (
        <View className="h-7 w-7 items-center justify-center rounded-lg bg-background/60">
          <Text className="font-inter-semibold text-xs text-muted">{exercise.order}</Text>
        </View>
      ) : null}
      <View className="flex-1">
        <Text className="font-inter-semibold text-sm text-foreground">{exercise.name}</Text>
        <Text className="mt-0.5 font-sans text-xs text-muted">
          {exercise.sets} serie × {exercise.reps} rep
          {exercise.weightKg > 0 ? ` · ${exercise.weightKg} kg` : ""}
        </Text>
      </View>
    </View>
  );
}