import { useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  FileText,
  Minus,
  PenLine,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react-native";
import type { DayOfWeek, ExerciseTemplate } from "@/types";
import { isApiError } from "@/lib/api";
import { aiErrorMessage, useGenerateWorkout, useReadFile, type AiFileWorkout } from "@/lib/aiQueries";
import { documentMimeType, DocumentReadError, readDocumentBase64 } from "@/lib/fileReader";
import { useSaveWorkoutDay, useSaveWorkoutPlan } from "@/lib/workoutQueries";
import {
  AI_GOAL_OPTIONS,
  AI_LEVEL_OPTIONS,
  getDayShortLabel,
  getDefaultExercises,
  MOCK_EXERCISE_LIBRARY,
  TRAINING_TYPES,
  type TrainingTypeKey,
  WEEKDAYS,
  WORKOUT_EQUIPMENT_OPTIONS,
} from "@/lib/mock-data";

type Mode =
  | "menu"
  | "manual"
  | "upload"
  | "upload-loading"
  | "upload-result"
  | "ai"
  | "ai-loading"
  | "ai-result";

const AI_STEPS = ["Obiettivo", "Livello", "Giorni", "Attrezzatura"] as const;
const MIN_DAYS = 2;
const MAX_DAYS = 6;

/** Esercizio in costruzione nel form manuale (valori numerici come stringhe). */
type FormExercise = {
  id: string;
  name: string;
  sets: string;
  reps: string;
  weight: string;
};

/**
 * Anteprima di una scheda generata dall'AI o importata da file: la stessa
 * forma per entrambi i flussi, così una sola schermata di risultato fa da
 * conferma prima della chiusura (e del salvataggio, per il file).
 */
type PreviewExercise = {
  name: string;
  sets: number;
  reps: number;
  weightKg: number | null;
  restSeconds: number | null;
  notes: string | null;
};

type PlanPreview = {
  name: string;
  days: { name: string; exercises: PreviewExercise[] }[];
};

let uidCounter = 0;
const nextUid = () => `form-ex-${++uidCounter}`;

const toFormExercise = (item: Pick<ExerciseTemplate, "name" | "sets" | "reps" | "weightKg">): FormExercise => ({
  id: nextUid(),
  name: item.name,
  sets: String(item.sets),
  reps: String(item.reps),
  weight: item.weightKg > 0 ? String(item.weightKg) : "",
});

const MODE_TITLES: Record<Mode, string> = {
  menu: "Crea scheda",
  manual: "Crea manualmente",
  upload: "Carica file esistente",
  "upload-loading": "Carica file esistente",
  "upload-result": "Carica file esistente",
  ai: "Genera con AI",
  "ai-loading": "Genera con AI",
  "ai-result": "Genera con AI",
};

type CreateWorkoutModalProps = {
  visible: boolean;
  /** Piano a cui agganciare il giorno; null = primo giorno (si crea qui). */
  planId: string | null;
  onClose: () => void;
  /** Chiamata con l'id del giorno salvato (per aprirlo nella lista). */
  onDone: (dayId: string) => void;
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="font-inter-semibold text-sm text-foreground">{title}</Text>
      {children}
    </View>
  );
}

function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`cursor-pointer rounded-full border px-4 py-2.5 active:opacity-80 ${
        selected ? "border-primary bg-primary/15" : "border-border bg-surface"
      }`}
    >
      <Text
        className={`font-inter-semibold text-sm ${selected ? "text-primary" : "text-muted"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function NumberField({
  label,
  value,
  onChangeText,
  accessibilityLabel,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  accessibilityLabel?: string;
}) {
  return (
    <View className="flex-1">
      <Text className="mb-1 font-sans text-xs text-muted">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
        accessibilityLabel={accessibilityLabel ?? label}
        placeholder="0"
        placeholderTextColor="#64748B"
        className="rounded-lg border border-border bg-surface px-3 py-2 text-center font-sans text-foreground"
      />
    </View>
  );
}

function IconButton({
  onPress,
  disabled = false,
  destructive = false,
  accessibilityLabel,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
  accessibilityLabel: string;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={`h-11 w-11 cursor-pointer items-center justify-center rounded-lg active:opacity-80 ${
        disabled ? "opacity-30" : destructive ? "bg-destructive/15" : "bg-background/60"
      }`}
    >
      {children}
    </Pressable>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className={`flex-row cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary py-3.5 active:opacity-80 ${
        disabled ? "opacity-40" : ""
      }`}
    >
      {icon}
      <Text className="font-inter-bold text-base text-primary-foreground">{label}</Text>
    </Pressable>
  );
}

/**
 * Modal "Crea scheda" con tre flussi, tutti collegati al backend:
 *
 * - manuale → `POST /workout-days` (e piano al primo uso);
 * - importa file → `POST /ai/file-read` con anteprima, poi salvataggio;
 * - genera con AI → `POST /ai/workout-generate`, che salva direttamente
 *   il piano (funzione premium) e torna la scheda pronta da usare.
 */
export function CreateWorkoutModal({
  visible,
  planId,
  onClose,
  onDone,
}: CreateWorkoutModalProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [mode, setMode] = useState<Mode>("menu");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Scrittura reale: giorno singolo (manuale) o scheda intera (file).
  const saveDay = useSaveWorkoutDay();
  const savePlan = useSaveWorkoutPlan();

  // Generazione e lettura file: le due chiamate AI del modal.
  const generate = useGenerateWorkout();
  const readFile = useReadFile();

  // Stato del flusso manuale.
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>("monday");
  const [trainingKey, setTrainingKey] = useState<TrainingTypeKey>("push");
  const [exercises, setExercises] = useState<FormExercise[]>(() => getDefaultExercises("push").map(toFormExercise));

  // Stato del flusso importazione file.
  const [fileName, setFileName] = useState<string | null>(null);

  // Stato del flusso AI.
  const [aiStep, setAiStep] = useState(0);
  const [aiGoal, setAiGoal] = useState("ipertrofia");
  const [aiLevel, setAiLevel] = useState("intermedio");
  const [aiDays, setAiDays] = useState(4);
  const [aiEquipment, setAiEquipment] = useState<string[]>(["palestra"]);

  /**
   * Risultato da mostrare in conferma. `saved` = il piano è già sul
   * server (generazione AI): il pulsante chiude e basta, mentre per
   * l'importazione file parte il salvataggio.
   */
  const [preview, setPreview] = useState<{
    plan: PlanPreview;
    saved: boolean;
    firstDayId: string | null;
  } | null>(null);

  /** Una richiesta AI o di salvataggio è in corso (niente navigazione). */
  const busy = generate.isPending || readFile.isPending || savePlan.isPending;

  const libraryGroups = useMemo(() => {
    const map = new Map<string, ExerciseTemplate[]>();
    for (const item of MOCK_EXERCISE_LIBRARY) {
      const group = item.muscleGroups[0] ?? "Altri";
      map.set(group, [...(map.get(group) ?? []), item]);
    }
    return Array.from(map.entries());
  }, []);

  /* ------------------------- Flusso manuale ------------------------- */

  function handleTypeChange(key: TrainingTypeKey) {
    setTrainingKey(key);
    if (key === "rest") {
      setExercises([]);
      return;
    }
    setExercises(getDefaultExercises(key).map(toFormExercise));
  }

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
    setExercises((prev) => [...prev, toFormExercise(item)]);
  }

  async function handleSaveManual() {
    const type = TRAINING_TYPES.find((t) => t.key === trainingKey);
    if (!type || saving) return;
    if (trainingKey !== "rest" && exercises.length === 0) return;

    const parsedExercises = exercises.map((ex) => ({
      name: ex.name,
      sets: parseInt(ex.sets, 10) > 0 ? parseInt(ex.sets, 10) : 3,
      reps: parseInt(ex.reps, 10) > 0 ? parseInt(ex.reps, 10) : 10,
      weightKg: parseFloat(ex.weight.replace(",", ".")) > 0
        ? parseFloat(ex.weight.replace(",", "."))
        : 0,
    }));

    setSaving(true);
    setError(null);
    try {
      // Scrittura reale: piano (se non c'è) → giorno → esercizi.
      const { dayId } = await saveDay.mutateAsync({
        planId,
        dayOfWeek,
        name: trainingKey === "rest" ? "Riposo" : `Giorno ${type.label}`,
        exercises: parsedExercises,
      });
      onDone(dayId);
      handleClose();
    } catch (err) {
      setError(
        isApiError(err) ? err.message : "Salvataggio non riuscito: controlla la connessione.",
      );
    } finally {
      setSaving(false);
    }
  }

  /* --------------------- Flusso importa file ------------------------ */

  /** Converte la bozza di `POST /ai/file-read` nell'anteprima comune. */
  function toPlanPreview(workout: AiFileWorkout): PlanPreview {
    return {
      name: workout.name,
      days: workout.days.map((day) => ({
        name: day.name,
        exercises: day.exercises.map((exercise) => ({
          name: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          weightKg: exercise.weight_kg,
          restSeconds: exercise.rest_seconds,
          notes: exercise.notes,
        })),
      })),
    };
  }

  /**
   * File → `POST /ai/file-read` (kind "workout"): la scheda estratta
   * torna come bozza e si salva solo quando l'utente conferma.
   */
  async function handlePickFile() {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;
      setFileName(asset.name);
      setMode("upload-loading");
      const mimeType = documentMimeType(asset);
      const file = await readDocumentBase64(asset);
      const extracted = await readFile.mutateAsync({ file, mimeType, kind: "workout" });
      if (extracted.kind !== "workout") {
        setError("Il file sembra una dieta: importala dalla sezione Dieta.");
        setMode("upload");
        return;
      }
      setPreview({ plan: toPlanPreview(extracted.workout), saved: false, firstDayId: null });
      setMode("upload-result");
    } catch (err) {
      setError(err instanceof DocumentReadError ? err.message : aiErrorMessage(err));
      setMode("upload");
    }
  }

  /* --------------------------- Flusso AI ---------------------------- */

  /**
   * `POST /ai/workout-generate`: il backend salva il piano (funzione
   * premium) e torna giorni ed esercizi già pronti, qui solo mostrati.
   */
  async function startGeneration() {
    setError(null);
    setMode("ai-loading");
    try {
      const goal = AI_GOAL_OPTIONS.find((option) => option.key === aiGoal)?.label ?? aiGoal;
      const level = AI_LEVEL_OPTIONS.find((option) => option.key === aiLevel)?.label ?? aiLevel;
      const equipment = aiEquipment.map(
        (key) => WORKOUT_EQUIPMENT_OPTIONS.find((option) => option.key === key)?.label ?? key,
      );
      const plan = await generate.mutateAsync({ goal, level, daysPerWeek: aiDays, equipment });
      setPreview({
        plan: {
          name: plan.name,
          days: plan.workout_days.map((day) => ({
            name: day.name,
            exercises: day.exercises.map((exercise) => ({
              name: exercise.name,
              sets: exercise.sets,
              reps: exercise.reps,
              weightKg: exercise.weight_kg,
              restSeconds: exercise.rest_seconds,
              notes: exercise.notes,
            })),
          })),
        },
        saved: true,
        firstDayId: plan.workout_days[0]?.id ?? null,
      });
      setMode("ai-result");
    } catch (err) {
      setError(aiErrorMessage(err));
      setMode("ai");
    }
  }

  /**
   * Chiusura della conferma: la scheda generata è già sul server (basta
   * aprirla), quella importata va ancora salvata (piano → giorni → esercizi).
   */
  async function handleApplyPreview() {
    if (!preview || saving) return;
    setError(null);
    if (preview.saved) {
      if (preview.firstDayId) onDone(preview.firstDayId);
      handleClose();
      return;
    }
    setSaving(true);
    try {
      const { firstDayId } = await savePlan.mutateAsync({
        name: preview.plan.name,
        source: "upload",
        days: preview.plan.days.map((day) => ({
          name: day.name,
          exercises: day.exercises.map((exercise) => ({
            name: exercise.name,
            sets: exercise.sets,
            reps: exercise.reps,
            weightKg: exercise.weightKg ?? 0,
            restSeconds: exercise.restSeconds,
            notes: exercise.notes,
          })),
        })),
      });
      onDone(firstDayId);
      handleClose();
    } catch (err) {
      setError(isApiError(err) ? err.message : "Salvataggio non riuscito: controlla la connessione.");
    } finally {
      setSaving(false);
    }
  }

  function goBack() {
    // Una richiesta in corso non si interrompe: aspetta il risultato.
    if (busy) return;
    if (mode === "ai" && aiStep > 0) {
      setAiStep((step) => step - 1);
      return;
    }
    setMode("menu");
  }

  // Reset di tutti gli stati alla chiusura: la riapertura parte sempre pulita
  // (un'effect che fa setState all'apertura è vietata dal lint).
  function resetFormState() {
    setMode("menu");
    setError(null);
    setSaving(false);
    setDayOfWeek("monday");
    setTrainingKey("push");
    setExercises(getDefaultExercises("push").map(toFormExercise));
    setFileName(null);
    setAiStep(0);
    setAiGoal("ipertrofia");
    setAiLevel("intermedio");
    setAiDays(4);
    setAiEquipment(["palestra"]);
    setPreview(null);
  }

  function handleClose() {
    resetFormState();
    onClose();
  }

  const title = MODE_TITLES[mode];

  /**
   * Conferma comune a file e AI: giorni con esercizi, serie e ripetizioni.
   * Stessa forma per entrambi i flussi, così la lettura resta fedele a ciò
   * che il modello ha estratto o generato.
   */
  const previewSection = preview ? (
    <View className="gap-2">
      {preview.plan.days.map((day, index) => (
        <View
          key={`${day.name}-${index}`}
          className="rounded-xl border border-border bg-background/40 p-3"
        >
          <View className="flex-row items-center gap-2">
            <Text className="h-6 w-6 text-center font-inter-semibold text-xs text-muted">
              {index + 1}
            </Text>
            <Text className="flex-1 font-inter-semibold text-sm text-foreground">
              {day.name}
            </Text>
            <Text className="font-sans text-xs text-muted">
              {day.exercises.length} esercizi
            </Text>
          </View>
          <Text className="mt-1 pl-8 font-sans text-xs text-muted" numberOfLines={2}>
            {day.exercises.length === 0
              ? "Nessun esercizio"
              : `${day.exercises
                  .slice(0, 4)
                  .map((exercise) => `${exercise.name} ${exercise.sets}×${exercise.reps}`)
                  .join(" · ")}${day.exercises.length > 4 ? " …" : ""}`}
          </Text>
        </View>
      ))}
    </View>
  ) : null;

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
              {mode !== "menu" && !busy ? (
                <Pressable
                  onPress={goBack}
                  accessibilityRole="button"
                  accessibilityLabel="Torna indietro"
                  className="h-11 w-11 cursor-pointer items-center justify-center rounded-lg active:opacity-80"
                >
                  <ChevronLeft size={22} color="#F8FAFC" strokeWidth={2.2} />
                </Pressable>
              ) : null}
              <Text className="flex-1 font-inter-bold text-lg text-foreground">{title}</Text>
              <Pressable
                onPress={handleClose}
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
              {/* ---------------------------- MENU ---------------------------- */}
              {mode === "menu" ? (
                <View className="gap-3">
                  <MenuOption
                    icon={<PenLine size={22} color="#F97316" strokeWidth={2.2} />}
                    title="Crea manualmente"
                    description="Scegli giorno, tipo di allenamento ed esercizi, poi riordinali."
                    onPress={() => setMode("manual")}
                  />
                  <MenuOption
                    icon={<FileText size={22} color="#22C55E" strokeWidth={2.2} />}
                    title="Carica file esistente"
                    description="PDF o foto della scheda: l’AI la legge e la mostra da confermare. Funzione premium."
                    onPress={() => setMode("upload")}
                  />
                  <MenuOption
                    icon={<Sparkles size={22} color="#38BDF8" strokeWidth={2.2} />}
                    title="Genera con AI"
                    description="Rispondi a 4 domande: la scheda si compone e si salva da sola. Funzione premium."
                    onPress={() => setMode("ai")}
                  />
                </View>
              ) : null}

              {/* ---------------------- CREA MANUALMENTE --------------------- */}
              {mode === "manual" ? (
                <>
                  <Section title="Giorno della settimana">
                    <View className="flex-row flex-wrap gap-2">
                      {WEEKDAYS.map((day) => (
                        <Chip
                          key={day}
                          label={getDayShortLabel(day)}
                          selected={dayOfWeek === day}
                          onPress={() => setDayOfWeek(day)}
                        />
                      ))}
                    </View>
                  </Section>

                  <Section title="Tipo di allenamento">
                    <View className="flex-row flex-wrap gap-2">
                      {TRAINING_TYPES.map((type) => (
                        <Chip
                          key={type.key}
                          label={type.label}
                          selected={trainingKey === type.key}
                          onPress={() => handleTypeChange(type.key)}
                        />
                      ))}
                    </View>
                  </Section>

                  {trainingKey !== "rest" ? (
                    <>
                      {exercises.length > 0 ? (
                        <Section title={`Esercizi (${exercises.length})`}>
                          <View className="gap-2">
                            {exercises.map((exercise, index) => (
                              <View
                                key={exercise.id}
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
                                    onChangeText={(text) =>
                                      patchExercise(index, { sets: text })
                                    }
                                    accessibilityLabel={`Serie di ${exercise.name}`}
                                  />
                                  <NumberField
                                    label="Rip"
                                    value={exercise.reps}
                                    onChangeText={(text) =>
                                      patchExercise(index, { reps: text })
                                    }
                                    accessibilityLabel={`Ripetizioni di ${exercise.name}`}
                                  />
                                  <NumberField
                                    label="Kg"
                                    value={exercise.weight}
                                    onChangeText={(text) =>
                                      patchExercise(index, { weight: text })
                                    }
                                    accessibilityLabel={`Peso di ${exercise.name}`}
                                  />
                                </View>
                              </View>
                            ))}
                          </View>
                        </Section>
                      ) : (
                        <Text className="font-sans text-sm text-muted">
                          Nessun esercizio: aggiungili dalla libreria qui sotto.
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
                                <View
                                  key={item.id}
                                  className="flex-row items-center gap-2 rounded-lg py-2"
                                >
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
                    </>
                  ) : (
                    <View className="rounded-xl border border-accent/40 bg-accent/10 p-4">
                      <Text className="font-sans text-sm leading-5 text-muted">
                        Giorno di riposo: nessun esercizio. Il badge “Riposo” comparirà sulla
                        card del {getDayShortLabel(dayOfWeek).toLowerCase()}.
                      </Text>
                    </View>
                  )}

                  <PrimaryButton
                    label={saving ? "Salvataggio…" : "Salva giorno"}
                    onPress={handleSaveManual}
                    disabled={saving || (trainingKey !== "rest" && exercises.length === 0)}
                  />
                </>
              ) : null}

              {/* ----------------------- CARICA FILE ------------------------- */}
              {mode === "upload" ? (
                <>
                  <Text className="font-sans text-sm leading-5 text-muted">
                    Seleziona un file PDF o una foto della tua scheda: l’AI ne estrae giorni,
                    esercizi e pesi e te li mostra qui per conferma, senza salvare nulla.
                    Funzione premium.
                  </Text>
                  <Pressable
                    onPress={handlePickFile}
                    accessibilityRole="button"
                    accessibilityLabel="Scegli un file PDF o una foto"
                    className="cursor-pointer items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-background/40 py-8 active:opacity-80"
                  >
                    <FileText size={24} color="#F97316" strokeWidth={2.2} />
                    <Text className="font-inter-semibold text-sm text-foreground">
                      Scegli file (PDF o foto)
                    </Text>
                  </Pressable>
                </>
              ) : null}

              {mode === "upload-loading" ? (
                <View className="items-center gap-3 py-6">
                  <ActivityIndicator size="large" color="#F97316" />
                  <Text className="font-inter-semibold text-base text-foreground">
                    Elaborazione file…
                  </Text>
                  {fileName ? (
                    <Text className="font-sans text-sm text-muted">{fileName}</Text>
                  ) : null}
                  <Text className="text-center font-sans text-sm leading-5 text-muted">
                    Estrazione di giorni, esercizi e pesi in corso: può volerci qualche
                    decina di secondi.
                  </Text>
                </View>
              ) : null}

              {mode === "upload-result" && preview ? (
                <>
                  <View className="items-center gap-3 py-2">
                    <View className="h-14 w-14 items-center justify-center rounded-full bg-accent/15">
                      <Check size={26} color="#22C55E" strokeWidth={2.5} />
                    </View>
                    <Text className="font-inter-bold text-lg text-foreground">
                      Scheda letta dal file
                    </Text>
                    {fileName ? (
                      <Text className="font-sans text-sm text-muted">{fileName}</Text>
                    ) : null}
                    <Text className="text-center font-sans text-xs text-muted">
                      Controlla giorni ed esercizi prima di salvare: nomi, serie e pesi sono
                      quelli letti dal documento.
                    </Text>
                  </View>

                  <View className="gap-1">
                    <Text className="font-inter-bold text-xl text-foreground">
                      {preview.plan.name}
                    </Text>
                  </View>

                  {previewSection}

                  <PrimaryButton
                    label={saving ? "Salvataggio…" : "Aggiungi alla scheda"}
                    onPress={handleApplyPreview}
                    disabled={saving}
                  />
                </>
              ) : null}

              {/* -------------------------- GENERA CON AI --------------------- */}
              {mode === "ai" ? (
                <>
                  <View className="flex-row items-center justify-between">
                    <Text className="font-sans text-xs text-muted">
                      Passo {aiStep + 1} di {AI_STEPS.length}
                    </Text>
                    <Text className="font-inter-semibold text-sm text-foreground">
                      {AI_STEPS[aiStep]}
                    </Text>
                  </View>

                  {aiStep === 0 ? (
                    <Section title="Qual è il tuo obiettivo?">
                      <View className="flex-row flex-wrap gap-2">
                        {AI_GOAL_OPTIONS.map((option) => (
                          <Chip
                            key={option.key}
                            label={option.label}
                            selected={aiGoal === option.key}
                            onPress={() => setAiGoal(option.key)}
                          />
                        ))}
                      </View>
                    </Section>
                  ) : null}

                  {aiStep === 1 ? (
                    <Section title="Qual è il tuo livello?">
                      <View className="flex-row flex-wrap gap-2">
                        {AI_LEVEL_OPTIONS.map((option) => (
                          <Chip
                            key={option.key}
                            label={option.label}
                            selected={aiLevel === option.key}
                            onPress={() => setAiLevel(option.key)}
                          />
                        ))}
                      </View>
                    </Section>
                  ) : null}

                  {aiStep === 2 ? (
                    <Section title="Quanti giorni alla settimana?">
                      <View className="flex-row items-center justify-center gap-4">
                        <IconButton
                          onPress={() => setAiDays((d) => Math.max(MIN_DAYS, d - 1))}
                          disabled={aiDays <= MIN_DAYS}
                          accessibilityLabel="Riduci i giorni"
                        >
                          <Minus size={18} color="#94A3B8" strokeWidth={2.2} />
                        </IconButton>
                        <Text className="w-24 text-center font-inter-bold text-2xl text-foreground">
                          {aiDays} giorni
                        </Text>
                        <IconButton
                          onPress={() => setAiDays((d) => Math.min(MAX_DAYS, d + 1))}
                          disabled={aiDays >= MAX_DAYS}
                          accessibilityLabel="Aumenta i giorni"
                        >
                          <Plus size={18} color="#94A3B8" strokeWidth={2.2} />
                        </IconButton>
                      </View>
                    </Section>
                  ) : null}

                  {aiStep === 3 ? (
                    <Section title="Che attrezzatura hai a disposizione?">
                      <View className="flex-row flex-wrap gap-2">
                        {WORKOUT_EQUIPMENT_OPTIONS.map((option) => {
                          const selected = aiEquipment.includes(option.key);
                          return (
                            <Chip
                              key={option.key}
                              label={option.label}
                              selected={selected}
                              onPress={() =>
                                setAiEquipment((prev) =>
                                  selected
                                    ? prev.filter((key) => key !== option.key)
                                    : [...prev, option.key],
                                )
                              }
                            />
                          );
                        })}
                      </View>
                    </Section>
                  ) : null}

                  <View className="flex-row gap-2">
                    {aiStep > 0 ? (
                      <Pressable
                        onPress={() => setAiStep((step) => step - 1)}
                        accessibilityRole="button"
                        className="cursor-pointer items-center rounded-xl border border-border bg-background/60 px-5 py-3.5 active:opacity-80"
                      >
                        <Text className="font-inter-semibold text-base text-muted">Indietro</Text>
                      </Pressable>
                    ) : null}
                    <View className="flex-1">
                      <PrimaryButton
                        label={aiStep === AI_STEPS.length - 1 ? "Genera scheda" : "Avanti"}
                        onPress={() => (aiStep < AI_STEPS.length - 1 ? setAiStep((s) => s + 1) : startGeneration())}
                        icon={aiStep === AI_STEPS.length - 1 ? <Sparkles size={18} color="#0F172A" strokeWidth={2.2} /> : undefined}
                      />
                    </View>
                  </View>

                  {aiEquipment.length === 0 && aiStep === 3 ? (
                    <Text className="text-center font-sans text-xs text-destructive">
                      Seleziona almeno un’opzione di attrezzatura.
                    </Text>
                  ) : null}
                </>
              ) : null}

              {mode === "ai-loading" ? (
                <View className="items-center gap-3 py-6">
                  <ActivityIndicator size="large" color="#F97316" />
                  <Text className="font-inter-semibold text-base text-foreground">
                    Generazione della scheda…
                  </Text>
                  <Text className="text-center font-sans text-sm leading-5 text-muted">
                    Stiamo componendo i giorni in base a obiettivo, livello e attrezzatura:
                    può volerci qualche decina di secondi.
                  </Text>
                </View>
              ) : null}

              {mode === "ai-result" && preview ? (
                <>
                  <View className="gap-1">
                    <Text className="font-inter-bold text-xl text-foreground">
                      {preview.plan.name}
                    </Text>
                    <Text className="font-sans text-sm text-muted">
                      {AI_GOAL_OPTIONS.find((g) => g.key === aiGoal)?.label} ·{" "}
                      {AI_LEVEL_OPTIONS.find((l) => l.key === aiLevel)?.label} · scheda
                      salvata
                    </Text>
                  </View>

                  {previewSection}

                  <PrimaryButton label="Vai alla scheda" onPress={handleApplyPreview} />

                  <Pressable
                    onPress={() => {
                      setPreview(null);
                      setAiStep(0);
                      setMode("ai");
                    }}
                    accessibilityRole="button"
                    className="cursor-pointer items-center rounded-xl border border-border bg-background/60 py-3.5 active:opacity-80"
                  >
                    <Text className="font-inter-semibold text-base text-muted">Rigenera</Text>
                  </Pressable>
                </>
              ) : null}
              {/* Errore comune a tutti i flussi (salvataggio, lettura o generazione) */}
              {error ? (
                <Text className="font-sans text-sm text-destructive">{error}</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MenuOption({
  icon,
  title,
  description,
  onPress,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="cursor-pointer flex-row items-center gap-3 rounded-2xl border border-border bg-background/40 p-4 active:opacity-80"
    >
      <View className="h-11 w-11 items-center justify-center rounded-xl bg-surface">{icon}</View>
      <View className="flex-1">
        <Text className="font-inter-semibold text-base text-foreground">{title}</Text>
        <Text className="mt-0.5 font-sans text-sm leading-5 text-muted">{description}</Text>
      </View>
    </Pressable>
  );
}