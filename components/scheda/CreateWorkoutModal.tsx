import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import type { DayOfWeek, ExerciseTemplate, WorkoutDraft } from "@/types";
import {
  AI_GOAL_OPTIONS,
  AI_LEVEL_OPTIONS,
  applyWorkoutDraft,
  buildImportedWorkoutDraft,
  generateMockWorkout,
  getDayShortLabel,
  getDefaultExercises,
  MOCK_EXERCISE_LIBRARY,
  TRAINING_TYPES,
  type TrainingTypeKey,
  upsertWorkoutDay,
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
  onClose: () => void;
  /** Chiamata quando una scheda viene salvata/aggiunta (refresh lista). */
  onDone: () => void;
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
 * Modal "Crea scheda" con tre flussi: creazione manuale (giorno + tipo +
 * esercizi riordinabili), importazione di un file esistente (PDF/foto,
 * elaborazione mock) e generazione AI multi-step (obiettivo, livello,
 * giorni, attrezzatura → anteprima mock).
 */
export function CreateWorkoutModal({ visible, onClose, onDone }: CreateWorkoutModalProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [mode, setMode] = useState<Mode>("menu");
  const [error, setError] = useState<string | null>(null);

  // Stato del flusso manuale.
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>("monday");
  const [trainingKey, setTrainingKey] = useState<TrainingTypeKey>("push");
  const [exercises, setExercises] = useState<FormExercise[]>([]);

  // Stato del flusso importazione file.
  const [fileName, setFileName] = useState<string | null>(null);

  // Stato del flusso AI.
  const [aiStep, setAiStep] = useState(0);
  const [aiGoal, setAiGoal] = useState("ipertrofia");
  const [aiLevel, setAiLevel] = useState("intermedio");
  const [aiDays, setAiDays] = useState(4);
  const [aiEquipment, setAiEquipment] = useState<string[]>(["palestra"]);
  const [aiDraft, setAiDraft] = useState<WorkoutDraft | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function schedule(action: () => void, ms: number) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(action, ms);
  }

  // Pulisce i timer in sospeso.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Reset di tutti gli stati alla riapertura.
  useEffect(() => {
    if (!visible) return;
    setMode("menu");
    setError(null);
    setDayOfWeek("monday");
    setTrainingKey("push");
    setExercises(getDefaultExercises("push").map(toFormExercise));
    setFileName(null);
    setAiStep(0);
    setAiGoal("ipertrofia");
    setAiLevel("intermedio");
    setAiDays(4);
    setAiEquipment(["palestra"]);
    setAiDraft(null);
  }, [visible]);

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

  function handleSaveManual() {
    const type = TRAINING_TYPES.find((t) => t.key === trainingKey);
    if (!type) return;
    if (trainingKey !== "rest" && exercises.length === 0) return;

    const parsedExercises = exercises.map((ex) => ({
      name: ex.name,
      sets: parseInt(ex.sets, 10) > 0 ? parseInt(ex.sets, 10) : 3,
      reps: parseInt(ex.reps, 10) > 0 ? parseInt(ex.reps, 10) : 10,
      weightKg: parseFloat(ex.weight.replace(",", ".")) > 0
        ? parseFloat(ex.weight.replace(",", "."))
        : 0,
    }));

    upsertWorkoutDay({
      dayOfWeek,
      name: trainingKey === "rest" ? "Riposo" : `Giorno ${type.label}`,
      muscleGroups: type.muscleGroups,
      isRestDay: trainingKey === "rest",
      exercises: parsedExercises,
    });
    onDone();
    onClose();
  }

  /* --------------------- Flusso importa file ------------------------ */

  async function handlePickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;
      setFileName(asset.name ?? "Scheda.pdf");
      setError(null);
      setMode("upload-loading");
      schedule(() => setMode("upload-result"), 2200);
    } catch {
      setError("Impossibile aprire il selettore file.");
    }
  }

  function handleApplyImported() {
    const draft = buildImportedWorkoutDraft(fileName ?? "Scheda.pdf");
    applyWorkoutDraft(draft);
    onDone();
    onClose();
  }

  /* --------------------------- Flusso AI ---------------------------- */

  function startGeneration() {
    const draft = generateMockWorkout({
      goal: aiGoal,
      level: aiLevel,
      daysPerWeek: aiDays,
      equipment: aiEquipment,
    });
    setAiDraft(draft);
    setMode("ai-loading");
    schedule(() => setMode("ai-result"), 2000);
  }

  function handleApplyAi() {
    if (!aiDraft) return;
    applyWorkoutDraft(aiDraft);
    onDone();
    onClose();
  }

  function goBack() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (mode === "ai" && aiStep > 0) {
      setAiStep((step) => step - 1);
      return;
    }
    setMode("menu");
  }

  function handleClose() {
    if (timerRef.current) clearTimeout(timerRef.current);
    onClose();
  }

  const title = MODE_TITLES[mode];

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
              {mode !== "menu" ? (
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
                    description="PDF o foto della tua scheda (per ora elaborazione simulata)."
                    onPress={() => setMode("upload")}
                  />
                  <MenuOption
                    icon={<Sparkles size={22} color="#38BDF8" strokeWidth={2.2} />}
                    title="Genera con AI"
                    description="Rispondi a 4 domande: la scheda si compone da sola."
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
                        Giorno di riposo: nessun esercizio. Il badge "Riposo" comparirà sulla
                        card del {getDayShortLabel(dayOfWeek).toLowerCase()}.
                      </Text>
                    </View>
                  )}

                  <PrimaryButton
                    label="Salva giorno"
                    onPress={handleSaveManual}
                    disabled={trainingKey !== "rest" && exercises.length === 0}
                  />
                </>
              ) : null}

              {/* ----------------------- CARICA FILE ------------------------- */}
              {mode === "upload" ? (
                <>
                  <Text className="font-sans text-sm leading-5 text-muted">
                    Seleziona un file PDF o una foto della tua scheda: verrà analizzata per
                    estrarre giorni, esercizi e pesi (elaborazione AI in arrivo).
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
                  {error ? (
                    <Text className="font-sans text-sm text-destructive">{error}</Text>
                  ) : null}
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
                    Estrazione di giorni, esercizi e pesi in corso (mock: il collegamento
                    all'AI arriverà in una prossima versione).
                  </Text>
                </View>
              ) : null}

              {mode === "upload-result" ? (
                <>
                  <View className="items-center gap-3 py-2">
                    <View className="h-14 w-14 items-center justify-center rounded-full bg-accent/15">
                      <Check size={26} color="#22C55E" strokeWidth={2.5} />
                    </View>
                    <Text className="font-inter-bold text-lg text-foreground">
                      Analisi completata (mock)
                    </Text>
                    {fileName ? (
                      <Text className="font-sans text-sm text-muted">{fileName}</Text>
                    ) : null}
                    <View className="w-full rounded-xl border border-border bg-background/40 p-3">
                      <Text className="font-inter-semibold text-sm text-foreground">
                        Giorno importato
                      </Text>
                      <Text className="mt-0.5 font-sans text-xs text-muted">
                        Misto · 4 esercizi rilevati
                      </Text>
                    </View>
                    <Text className="text-center font-sans text-xs text-muted">
                      Anteprima simulata: la conversione reale verrà collegata all'AI.
                    </Text>
                  </View>
                  <PrimaryButton label="Aggiungi alla scheda" onPress={handleApplyImported} />
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
                      Seleziona almeno un'opzione di attrezzatura.
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
                    Stiamo componendo i giorni in base a obiettivo, livello e attrezzatura
                    (risultato simulato, AI in arrivo).
                  </Text>
                </View>
              ) : null}

              {mode === "ai-result" && aiDraft ? (
                <>
                  <View className="gap-1">
                    <Text className="font-inter-bold text-xl text-foreground">{aiDraft.name}</Text>
                    <Text className="font-sans text-sm text-muted">
                      {AI_GOAL_OPTIONS.find((g) => g.key === aiGoal)?.label} ·{" "}
                      {AI_LEVEL_OPTIONS.find((l) => l.key === aiLevel)?.label}
                    </Text>
                  </View>

                  <View className="gap-2">
                    {aiDraft.days.map((day, index) => (
                      <View
                        key={day.id}
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
                        <Text className="mt-1 pl-8 font-sans text-xs text-muted">
                          {day.muscleGroups.join(" · ")}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <PrimaryButton label="Aggiungi alla scheda" onPress={handleApplyAi} />

                  <Pressable
                    onPress={() => {
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