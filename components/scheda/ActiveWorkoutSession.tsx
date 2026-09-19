import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  SkipForward,
  Timer,
} from "lucide-react-native";
import type { WorkoutDay } from "@/types";
import { addWorkoutSession } from "@/lib/mock-data";
import { Card } from "@/components/home/Card";

/** Recupero standard tra le serie (secondi). */
const REST_SECONDS = 90;

type SetLog = {
  completed: boolean;
  weight: string;
  reps: string;
};

/** Log per esercizio: un SetLog per ogni serie programmata. */
type ExerciseLogs = SetLog[][];

function initLogs(day: WorkoutDay): ExerciseLogs {
  return day.exercises.map((exercise) =>
    Array.from({ length: exercise.sets }, () => ({
      completed: false,
      weight: exercise.weightKg > 0 ? String(exercise.weightKg) : "",
      reps: String(exercise.reps),
    })),
  );
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

type ActiveWorkoutSessionProps = {
  day: WorkoutDay;
};

/**
 * Vista allenamento attivo: progresso esercizi, registrazione serie
 * (completata / peso / ripetizioni), contatore serie, timer di recupero
 * e chiusura sessione → salvataggio nel mock store → ritorno alla Scheda.
 */
export function ActiveWorkoutSession({ day }: ActiveWorkoutSessionProps) {
  const [index, setIndex] = useState(0);
  const [logs, setLogs] = useState<ExerciseLogs>(() => initLogs(day));
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const startedAtRef = useRef(Date.now());

  const totalExercises = day.exercises.length;
  const current = day.exercises[index];
  const currentLog = logs[index];
  const isLast = index === totalExercises - 1;

  const completedInCurrent = currentLog.filter((set) => set.completed).length;
  const allSetsDone = completedInCurrent === currentLog.length;
  const totalSets = logs.reduce((sum, log) => sum + log.length, 0);
  const doneSets = logs.reduce((sum, log) => sum + log.filter((set) => set.completed).length, 0);

  // Avanzamento "Esercizio X di N": esercizi chiusi + frazione delle serie correnti.
  const progress =
    totalExercises === 0
      ? 0
      : Math.min(1, (index + completedInCurrent / currentLog.length) / totalExercises);

  // Countdown del recupero: -1 ogni secondo.
  useEffect(() => {
    if (restRemaining === null || restRemaining <= 0) return;
    const timeout = setTimeout(() => {
      setRestRemaining((value) => (value === null ? null : value - 1));
    }, 1000);
    return () => clearTimeout(timeout);
  }, [restRemaining]);

  function updateSet(setIndex: number, patch: Partial<SetLog>) {
    setLogs((prev) =>
      prev.map((exerciseLog, i) =>
        i === index
          ? exerciseLog.map((set, j) => (j === setIndex ? { ...set, ...patch } : set))
          : exerciseLog,
      ),
    );
  }

  function handleToggleSet(setIndex: number) {
    const wasCompleted = currentLog[setIndex].completed;
    updateSet(setIndex, { completed: !wasCompleted });
    // Completare una serie avvia il recupero.
    if (!wasCompleted) {
      setRestRemaining(REST_SECONDS);
    }
  }

  function handleNext() {
    if (!allSetsDone || isLast) return;
    setRestRemaining(null);
    setIndex((value) => value + 1);
  }

  function handleFinish() {
    if (!allSetsDone || !isLast) return;
    const endedAt = new Date();
    const startedAt = new Date(startedAtRef.current);
    const durationMinutes = Math.max(
      1,
      Math.round((endedAt.getTime() - startedAt.getTime()) / 60000),
    );
    const caloriesBurned = Math.round(durationMinutes * 8.5 + doneSets * 4);
    addWorkoutSession({
      dayId: day.id,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMinutes,
      caloriesBurned,
    });
    router.back();
  }

  const isRestDone = restRemaining === 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background"
    >
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-5 px-4 pb-8 pt-6"
      >
        {/* Header */}
        <View className="flex-row items-center gap-4">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Torna alla scheda"
            hitSlop={8}
            className="h-11 w-11 cursor-pointer items-center justify-center rounded-xl bg-surface active:opacity-80"
          >
            <ChevronLeft size={22} color="#F8FAFC" strokeWidth={2.2} />
          </Pressable>
          <View className="flex-1">
            <Text className="font-inter-bold text-2xl text-foreground">{day.name}</Text>
            <Text className="mt-0.5 font-sans text-sm text-muted">
              Esercizio {index + 1} di {totalExercises}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View className="h-2 w-full overflow-hidden rounded-full bg-surface">
          <View
            className="h-full rounded-full bg-primary"
            style={{ width: `${progress * 100}%` }}
          />
        </View>

        {/* Timer di recupero */}
        {restRemaining !== null ? (
          <Card className="flex-row items-center gap-4 p-4">
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
              <Timer size={22} color="#F97316" strokeWidth={2.2} />
            </View>
            <View className="flex-1">
              <Text className="font-sans text-xs text-muted">
                {isRestDone ? "Recupero terminato" : "Recupero tra le serie"}
              </Text>
              <Text className="font-inter-bold text-2xl tabular-nums text-foreground">
                {isRestDone ? "Pronto!" : formatClock(restRemaining)}
              </Text>
            </View>
            {!isRestDone ? (
              <Pressable
                onPress={() => setRestRemaining(null)}
                accessibilityRole="button"
                accessibilityLabel="Salta il recupero"
                className="flex-row cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-background/60 px-3.5 py-2.5 active:opacity-80"
              >
                <SkipForward size={16} color="#94A3B8" strokeWidth={2.2} />
                <Text className="font-inter-semibold text-sm text-muted">Salta</Text>
              </Pressable>
            ) : null}
          </Card>
        ) : null}

        {/* Esercizio corrente */}
        <Card className="p-4">
          <View className="flex-row items-start gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-accent/15">
              <Text className="font-inter-bold text-sm text-accent">{index + 1}</Text>
            </View>
            <View className="flex-1">
              <Text className="font-inter-bold text-lg leading-6 text-foreground">
                {current.name}
              </Text>
              <View className="mt-1 flex-row items-center flex-wrap gap-1.5">
                <Text className="font-sans text-xs text-muted">
                  {current.sets} serie programmate · {current.weightKg > 0 ? `${current.weightKg} kg` : "peso libero"}
                </Text>
                <View className="rounded-full bg-background/60 px-2.5 py-0.5">
                  <Text className="font-inter-semibold text-xs text-foreground">
                    {completedInCurrent}/{currentLog.length} serie
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Serie */}
          <View className="mt-4 gap-2">
            {currentLog.map((set, setIndex) => {
              const isSetDone = set.completed;
              return (
                <View
                  key={`${current.id}-set-${setIndex}`}
                  className={`rounded-xl border p-3 ${
                    isSetDone
                      ? "border-accent/40 bg-accent/10"
                      : "border-border bg-background/40"
                  }`}
                >
                  <View className="flex-row items-center gap-3">
                    {/* Checkbox completa serie */}
                    <Pressable
                      onPress={() => handleToggleSet(setIndex)}
                      accessibilityRole="checkbox"
                      accessibilityLabel={`Serie ${setIndex + 1} completata`}
                      accessibilityState={{ checked: isSetDone }}
                      className={`h-11 w-11 cursor-pointer items-center justify-center rounded-full border-2 ${
                        isSetDone
                          ? "border-accent bg-accent"
                          : "border-border bg-surface"
                      }`}
                    >
                      {isSetDone ? (
                        <Check size={20} color="#0F172A" strokeWidth={3} />
                      ) : null}
                    </Pressable>

                    <Text className="w-14 font-inter-semibold text-sm text-muted">
                      Serie {setIndex + 1}
                    </Text>

                    {/* Peso */}
                    <View className="flex-1">
                      <Text className="mb-1 font-sans text-xs text-muted">Peso (kg)</Text>
                      <TextInput
                        value={set.weight}
                        onChangeText={(text) => updateSet(setIndex, { weight: text })}
                        keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                        accessibilityLabel={`Peso serie ${setIndex + 1} in chilogrammi`}
                        placeholder={current.weightKg > 0 ? String(current.weightKg) : "0"}
                        placeholderTextColor="#64748B"
                        className="rounded-lg border border-border bg-surface px-3 py-2 text-center font-sans text-foreground"
                      />
                    </View>

                    {/* Ripetizioni effettive */}
                    <View className="flex-1">
                      <Text className="mb-1 font-sans text-xs text-muted">Rep</Text>
                      <TextInput
                        value={set.reps}
                        onChangeText={(text) => updateSet(setIndex, { reps: text })}
                        keyboardType="number-pad"
                        accessibilityLabel={`Ripetizioni effettive serie ${setIndex + 1}`}
                        placeholder={String(current.reps)}
                        placeholderTextColor="#64748B"
                        className="rounded-lg border border-border bg-surface px-3 py-2 text-center font-sans text-foreground"
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        {/* CTA: successivo / termina */}
        {isLast ? (
          <Pressable
            onPress={handleFinish}
            disabled={!allSetsDone}
            accessibilityRole="button"
            accessibilityLabel="Termina allenamento"
            className={`flex-row cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent py-4 active:opacity-80 ${
              allSetsDone ? "" : "opacity-40"
            }`}
          >
            <Flag size={18} color="#0F172A" strokeWidth={2.5} />
            <Text className="font-inter-bold text-base text-primary-foreground">
              Termina allenamento
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleNext}
            disabled={!allSetsDone}
            accessibilityRole="button"
            accessibilityLabel="Vai all'esercizio successivo"
            className={`flex-row cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary py-4 active:opacity-80 ${
              allSetsDone ? "" : "opacity-40"
            }`}
          >
            <Text className="font-inter-bold text-base text-primary-foreground">
              Esercizio successivo
            </Text>
            <ChevronRight size={18} color="#0F172A" strokeWidth={2.5} />
          </Pressable>
        )}

        {!allSetsDone ? (
          <Text className="text-center font-sans text-xs text-muted">
            Completa tutte le serie dell'esercizio per continuare.
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}