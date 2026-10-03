import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react-native";
import type { DayOfWeek, ExerciseTemplate, WorkoutDay } from "@/types";
import { isApiError } from "@/lib/api";
import { MOCK_EXERCISE_LIBRARY, WEEKDAYS, getDayShortLabel } from "@/lib/mock-data";
import { useUpdateWorkoutDay, type EditExerciseInput } from "@/lib/workoutQueries";
import { Chip, IconButton, NumberField, PrimaryButton, Section, TextField } from "./formControls";

/** Esercizio in costruzione nel form: i numeri come stringhe. */
type FormExercise = {
  /** Id sul server; null = riga nuova da inserire. */
  id: string | null;
  name: string;
  sets: string;
  reps: string;
  weight: string;
  rest: string;
  notes: string;
};

const toFormExercise = (exercise: {
  id?: string | null;
  name: string;
  sets: number;
  reps: number;
  weightKg?: number | null;
  restSeconds?: number | null;
  notes?: string | null;
}): FormExercise => ({
  id: exercise.id ?? null,
  name: exercise.name,
  sets: String(exercise.sets),
  reps: String(exercise.reps),
  weight: (exercise.weightKg ?? 0) > 0 ? String(exercise.weightKg) : "",
  rest: (exercise.restSeconds ?? 0) > 0 ? String(exercise.restSeconds) : "",
  notes: exercise.notes ?? "",
});

/** Legge un campo numerico tollerando la virgola decimale. */
function toNumber(value: string): number {
  const parsed = parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

type EditWorkoutDayModalProps = {
  visible: boolean;
  /** Giorno da modificare (dal dettaglio del piano). */
  day: WorkoutDay;
  planId: string;
  onClose: () => void;
  /** Chiamato dopo il salvataggio riuscito, con l'id del giorno. */
  onDone: (dayId: string) => void;
  /** Eliminazione del giorno (la conferma resta a chi apre il modal). */
  onDelete?: () => void;
};

/**
 * Modifica di un giorno esistente della scheda: nome, giorno della
 * settimana, esercizi (serie, ripetizioni, peso, riposo, nota) e relativi
 * ordine ed eliminazione.
 *
 * Salva in modo granulare (`useUpdateWorkoutDay`): il giorno e i suoi
 * esercizi vengono aggiornati, non ricreati, così le sessioni storiche
 * restano collegate. Il componente va montato con un `key` che cambia ad
 * ogni giorno: lo stato si inizializza dal `day` in ingresso e la
 * chiusura non serve a resettarlo.
 */
export function EditWorkoutDayModal({
  visible,
  day,
  planId,
  onClose,
  onDone,
  onDelete,
}: EditWorkoutDayModalProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [dayName, setDayName] = useState(day.name);
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(day.dayOfWeek);
  const [exercises, setExercises] = useState<FormExercise[]>(() =>
    day.exercises.map(toFormExercise),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const updateDay = useUpdateWorkoutDay();

  const libraryGroups = useMemo(() => {
    const map = new Map<string, ExerciseTemplate[]>();
    for (const item of MOCK_EXERCISE_LIBRARY) {
      const group = item.muscleGroups[0] ?? "Altri";
      map.set(group, [...(map.get(group) ?? []), item]);
    }
    return Array.from(map.entries());
  }, []);

  function patchExercise(index: number, patch: Partial<FormExercise>) {
    setExercises((prev) => prev.map((ex, i) => (i === index ? { ...ex, ...patch } : ex)));
  }

  function moveExercise(index: number, direction: -1 | 1) {
    setExercises((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeExercise(index: number) {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }

  function addFromLibrary(item: ExerciseTemplate) {
    setExercises((prev) => [
      ...prev,
      toFormExercise({
        id: null,
        name: item.name,
        sets: item.sets,
        reps: item.reps,
        weightKg: item.weightKg,
      }),
    ]);
  }

  async function handleSave() {
    if (saving) return;
    const name = dayName.trim() || day.name;
    const parsed: EditExerciseInput[] = exercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name.trim(),
      sets: Math.max(1, parseInt(exercise.sets, 10) || 1),
      reps: Math.max(1, parseInt(exercise.reps, 10) || 1),
      weightKg: toNumber(exercise.weight),
      restSeconds: Math.max(0, parseInt(exercise.rest, 10) || 0),
      notes: exercise.notes.trim() || null,
    }));
    if (parsed.some((exercise) => !exercise.name)) {
      setError("Ogni esercizio deve avere un nome.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { dayId } = await updateDay.mutateAsync({
        dayId: day.id,
        planId,
        dayOfWeek,
        name,
        exercises: parsed,
      });
      onDone(dayId);
      onClose();
    } catch (err) {
      setError(
        isApiError(err) ? err.message : "Salvataggio non riuscito: controlla la connessione.",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (saving) return;
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === "web" ? "none" : "slide"}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <View
          className="flex-1 bg-black/60"
          style={{ justifyContent: isWide ? "center" : "flex-end", alignItems: "center" }}
        >
          <View
            className={`w-full max-w-md overflow-hidden border border-border bg-surface ${
              isWide ? "rounded-2xl" : "rounded-t-3xl"
            }`}
            style={{ maxHeight: "92%" }}
          >
            {/* Header */}
            <View className="flex-row items-center gap-1 border-b border-border px-3 py-2">
              <Text className="flex-1 font-inter-bold text-lg text-foreground">
                Modifica giorno
              </Text>
              <Pressable
                onPress={handleClose}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Chiudi"
                className="h-11 w-11 cursor-pointer items-center justify-center rounded-lg active:opacity-80"
              >
                <X size={20} color="#94A3B8" strokeWidth={2.2} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerClassName="gap-5 p-4 pb-8"
            >
              <Section title="Nome del giorno">
                <TextField
                  label="Nome"
                  value={dayName}
                  onChangeText={setDayName}
                  placeholder="Es. Giorno 1 — Full body"
                  accessibilityLabel="Nome del giorno"
                />
              </Section>

              <Section title="Giorno della settimana">
                <View className="flex-row flex-wrap gap-2">
                  {WEEKDAYS.map((weekday) => (
                    <Chip
                      key={weekday}
                      label={getDayShortLabel(weekday)}
                      selected={dayOfWeek === weekday}
                      onPress={() => setDayOfWeek(weekday)}
                    />
                  ))}
                </View>
                {dayOfWeek !== day.dayOfWeek ? (
                  <Text className="font-sans text-xs leading-4 text-muted">
                    Se quel giorno è già occupato, i due giorni si scambiano la posizione.
                  </Text>
                ) : null}
              </Section>

              {exercises.length > 0 ? (
                <Section title={`Esercizi (${exercises.length})`}>
                  <View className="gap-2">
                    {exercises.map((exercise, index) => (
                      <View
                        key={exercise.id ?? `new-${index}`}
                        className="rounded-xl border border-border bg-background/40 p-3"
                      >
                        <View className="flex-row items-center gap-2">
                          <Text className="w-6 text-center font-inter-semibold text-xs text-muted">
                            {index + 1}
                          </Text>
                          <Text className="flex-1 font-inter-semibold text-sm text-foreground">
                            {exercise.name}
                          </Text>
                          <IconButton
                            onPress={() => moveExercise(index, -1)}
                            disabled={index === 0}
                            accessibilityLabel={`Sposta in alto ${exercise.name}`}
                          >
                            <ChevronUp size={18} color="#94A3B8" strokeWidth={2.2} />
                          </IconButton>
                          <IconButton
                            onPress={() => moveExercise(index, 1)}
                            disabled={index === exercises.length - 1}
                            accessibilityLabel={`Sposta in basso ${exercise.name}`}
                          >
                            <ChevronDown size={18} color="#94A3B8" strokeWidth={2.2} />
                          </IconButton>
                          <IconButton
                            onPress={() => removeExercise(index)}
                            destructive
                            accessibilityLabel={`Rimuovi ${exercise.name}`}
                          >
                            <Trash2 size={18} color="#F87171" strokeWidth={2.2} />
                          </IconButton>
                        </View>

                        <View className="mt-3 flex-row gap-2">
                          <NumberField
                            label="Serie"
                            value={exercise.sets}
                            onChangeText={(text) => patchExercise(index, { sets: text })}
                            accessibilityLabel={`Serie di ${exercise.name}`}
                          />
                          <NumberField
                            label="Rip"
                            value={exercise.reps}
                            onChangeText={(text) => patchExercise(index, { reps: text })}
                            accessibilityLabel={`Ripetizioni di ${exercise.name}`}
                          />
                          <NumberField
                            label="Kg"
                            value={exercise.weight}
                            onChangeText={(text) => patchExercise(index, { weight: text })}
                            accessibilityLabel={`Peso di ${exercise.name}`}
                          />
                        </View>

                        <View className="mt-2 flex-row gap-2">
                          <NumberField
                            label="Riposo (s)"
                            value={exercise.rest}
                            onChangeText={(text) => patchExercise(index, { rest: text })}
                            accessibilityLabel={`Riposo di ${exercise.name}`}
                          />
                          <TextField
                            label="Nota"
                            value={exercise.notes}
                            onChangeText={(text) => patchExercise(index, { notes: text })}
                            placeholder="Es. scendere in 2 secondi"
                            accessibilityLabel={`Nota di ${exercise.name}`}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                </Section>
              ) : (
                <Text className="font-sans text-sm text-muted">
                  Nessun esercizio: il giorno risulterà di riposo. Aggiungili dalla libreria qui
                  sotto.
                </Text>
              )}

              <Section title="Aggiungi esercizio">
                <View>
                  {libraryGroups.map(([group, items]) => (
                    <View key={group} className="mb-3">
                      <Text className="mb-1 font-inter-semibold text-xs uppercase tracking-wide text-muted">
                        {group}
                      </Text>
                      {items.map((item) => (
                        <View key={item.id} className="flex-row items-center gap-2 rounded-lg py-2">
                          <View className="flex-1">
                            <Text className="font-inter-semibold text-sm text-foreground">
                              {item.name}
                            </Text>
                            <Text className="mt-0.5 font-sans text-xs text-muted">
                              {item.sets}×{item.reps}
                              {item.weightKg > 0 ? ` · ${item.weightKg} kg` : ""}
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => addFromLibrary(item)}
                            accessibilityRole="button"
                            accessibilityLabel={`Aggiungi ${item.name}`}
                            className="h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-primary/15 active:opacity-80"
                          >
                            <Plus size={18} color="#F97316" strokeWidth={2.5} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </Section>

              <PrimaryButton
                label={saving ? "Salvataggio…" : "Salva modifiche"}
                onPress={handleSave}
                disabled={saving}
              />

              {onDelete ? (
                <Pressable
                  onPress={onDelete}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="Elimina giorno"
                  className="flex-row cursor-pointer items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 py-3.5 active:opacity-80"
                >
                  <Trash2 size={16} color="#F87171" strokeWidth={2.4} />
                  <Text className="font-inter-bold text-sm text-destructive">Elimina giorno</Text>
                </Pressable>
              ) : null}

              {error ? <Text className="font-sans text-sm text-destructive">{error}</Text> : null}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
