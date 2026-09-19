import { Platform, Pressable, Text, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { ChevronDown, ChevronUp, Dumbbell, Moon, Play } from "lucide-react-native";
import type { WorkoutDay } from "@/types";
import { getDayLabel } from "@/lib/mock-data";
import { Card } from "@/components/home/Card";
import { ExerciseItem } from "./ExerciseItem";

type WorkoutDayCardProps = {
  day: WorkoutDay;
  /** Evidenzia "Oggi" quando il giorno corrisponde alla data corrente. */
  isToday?: boolean;
  expanded: boolean;
  onToggle: () => void;
};

/**
 * Card espandibile di un giorno della settimana: header con nome del giorno,
 * muscoli coinvolti e badge di riposo; quando espansa mostra la lista
 * esercizi e il bottone "Inizia allenamento" (nascosto su desktop/web,
 * dove la scheda è in sola lettura).
 */
export function WorkoutDayCard({ day, isToday = false, expanded, onToggle }: WorkoutDayCardProps) {
  const { width } = useWindowDimensions();
  const isReadOnly = Platform.OS === "web" || width >= 768;
  const isRest = day.isRestDay;

  function handleStart() {
    if (isRest) return;
    router.push({
      pathname: "/(tabs)/scheda/allenamento/[dayId]",
      params: { dayId: day.id },
    });
  }

  return (
    <Card className="overflow-hidden p-0">
      {/* Header della card: intero tap per espandere/chiudere */}
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${getDayLabel(day.dayOfWeek)}, ${day.name}${isRest ? ", riposo" : ""}. Tocco per espandere`}
        accessibilityState={{ expanded }}
        className="cursor-pointer p-4 active:opacity-80"
      >
        <View className="flex-row items-center gap-3">
          <View
            className={`h-11 w-11 items-center justify-center rounded-xl ${
              isRest ? "bg-accent/15" : "bg-primary/15"
            }`}
          >
            {isRest ? (
              <Moon size={22} color="#22C55E" strokeWidth={2.2} />
            ) : (
              <Dumbbell size={22} color="#F97316" strokeWidth={2.2} />
            )}
          </View>

          <View className="flex-1">
            <Text className="font-sans text-xs text-muted">{getDayLabel(day.dayOfWeek)}</Text>
            <Text className="font-inter-bold text-lg leading-6 text-foreground">{day.name}</Text>
            <View className="mt-0.5 flex-row flex-wrap items-center gap-2">
              <Text className="font-sans text-xs text-muted">
                {isRest ? "Giorno di recupero" : day.muscleGroups.join(" · ")}
              </Text>
              {isRest ? (
                <View className="rounded-full bg-accent/15 px-2.5 py-0.5">
                  <Text className="font-inter-semibold text-xs text-accent">Riposo</Text>
                </View>
              ) : null}
              {isToday ? (
                <View className="rounded-full bg-primary/15 px-2.5 py-0.5">
                  <Text className="font-inter-semibold text-xs text-primary">Oggi</Text>
                </View>
              ) : null}
            </View>
          </View>

          {expanded ? (
            <ChevronUp size={20} color="#94A3B8" strokeWidth={2.2} />
          ) : (
            <ChevronDown size={20} color="#94A3B8" strokeWidth={2.2} />
          )}
        </View>
      </Pressable>

      {/* Contenuto espanso */}
      {expanded ? (
        <View className="border-t border-border px-4 pb-4 pt-1">
          {isRest ? (
            <Text className="py-3 font-sans text-sm leading-5 text-muted">
              Nessun esercizio previsto: recupera e ricarica le energie.
            </Text>
          ) : (
            <>
              {day.exercises.map((exercise) => (
                <ExerciseItem key={exercise.id} exercise={exercise} />
              ))}

              {!isReadOnly ? (
                <Pressable
                  onPress={handleStart}
                  accessibilityRole="button"
                  accessibilityLabel={`Inizia allenamento ${day.name}`}
                  className="mt-3 flex-row cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-primary py-3 active:opacity-80"
                >
                  <Play size={16} color="#0F172A" strokeWidth={2.5} />
                  <Text className="font-inter-bold text-sm text-primary-foreground">
                    Inizia allenamento
                  </Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </Card>
  );
}