import { Platform, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ChevronDown, ChevronUp, Dumbbell, Moon, PenLine, Play, Trash2 } from "lucide-react-native";
import type { WorkoutDay } from "@/types";
import { getDayLabel } from "@/lib/mock-data";
import { Card } from "@/components/home/Card";
import { useIsStandalone } from "@/lib/useStandalone";
import { ExerciseItem } from "./ExerciseItem";

type WorkoutDayCardProps = {
  day: WorkoutDay;
  /** Evidenzia "Oggi" quando il giorno corrisponde alla data corrente. */
  isToday?: boolean;
  expanded: boolean;
  onToggle: () => void;
  /** La scheda è modificabile su questa piattaforma (no browser PWA). */
  editable?: boolean;
  /** Apre il form di modifica del giorno. */
  onEdit?: () => void;
  /** Elimina il giorno (la conferma la fa chi apre). */
  onDelete?: () => void;
};

/**
 * Card espandibile di un giorno della settimana: header con nome del giorno,
 * muscoli coinvolti e badge di riposo; quando espansa mostra la lista
 * esercizi e il bottone "Inizia allenamento" (nascosto su desktop/web,
 * dove la scheda è in sola lettura).
 *
 * Con `editable` l'header espone matita (modifica) e cestino (elimina):
 * i due bottoni sono fratelli del tap di espansione, così un tocco non
 * attiva entrambe le azioni.
 */
export function WorkoutDayCard({
  day,
  isToday = false,
  expanded,
  onToggle,
  editable = false,
  onEdit,
  onDelete,
}: WorkoutDayCardProps) {
  const isStandalone = useIsStandalone();
  const isReadOnly = Platform.OS === "web" && !isStandalone;
  const isRest = day.isRestDay;

  function handleStart() {
    if (isRest) return;
    router.push({
      pathname: "/(tabs)/scheda/allenamento/[dayId]",
      params: { dayId: day.id },
    });
  }

  // Sottotitolo dell'header: riposo, gruppi muscolari (se noti) o il conteggio.
  const subtitle = isRest
    ? "Giorno di recupero"
    : day.muscleGroups.length > 0
      ? day.muscleGroups.join(" · ")
      : `${day.exercises.length} esercizi`;

  return (
    <Card className="overflow-hidden p-0">
      {/* Header: tap sulla zona di testo per espandere/chiudere, i bottoni
          di modifica ed eliminazione sono suoi fratelli (mai annidati,
          altrimenti un tocco aprirebbe anche il form). */}
      <View className="flex-row items-center gap-2 p-4 pb-3">
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={`${getDayLabel(day.dayOfWeek)}, ${day.name}${isRest ? ", riposo" : ""}. Tocco per espandere`}
          accessibilityState={{ expanded }}
          className="flex-1 cursor-pointer active:opacity-80"
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
                <Text className="font-sans text-xs text-muted">{subtitle}</Text>
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

        {editable ? (
          <View className="flex-row items-center gap-1.5">
            <Pressable
              onPress={onEdit}
              disabled={!onEdit}
              accessibilityRole="button"
              accessibilityLabel={`Modifica ${day.name}`}
              hitSlop={4}
              className={`h-10 w-10 items-center justify-center rounded-lg bg-background/60 active:opacity-80 ${
                onEdit ? "cursor-pointer" : "opacity-0"
              }`}
            >
              <PenLine size={17} color="#F97316" strokeWidth={2.2} />
            </Pressable>
            <Pressable
              onPress={onDelete}
              disabled={!onDelete}
              accessibilityRole="button"
              accessibilityLabel={`Elimina ${day.name}`}
              hitSlop={4}
              className={`h-10 w-10 items-center justify-center rounded-lg bg-destructive/15 active:opacity-80 ${
                onDelete ? "cursor-pointer" : "opacity-0"
              }`}
            >
              <Trash2 size={17} color="#F87171" strokeWidth={2.2} />
            </Pressable>
          </View>
        ) : null}
      </View>

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