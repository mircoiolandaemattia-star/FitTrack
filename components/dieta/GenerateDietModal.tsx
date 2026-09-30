import { useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Check, Sparkles, X } from "lucide-react-native";
import { aiErrorMessage, useGenerateDiet, type AiGeneratedDietPlan } from "@/lib/aiQueries";

type Props = {
  visible: boolean;
  onClose: () => void;
};

/** Obiettivo della dieta: la label è il testo che arriva al backend. */
const GOALS = [
  { key: "dimagrire", label: "Dimagrire" },
  { key: "mantenimento", label: "Mantenimento" },
  { key: "massa", label: "Aumentare la massa" },
] as const;

const DIET_TYPES = ["Onnivoro", "Vegetariano", "Vegano", "Pescatariano"] as const;

const MEALS_PER_DAY = [3, 4, 5] as const;

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
      <Text className={`font-inter-semibold text-sm ${selected ? "text-primary" : "text-muted"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Generazione della dieta (`POST /api/ai/diet-generate`, funzione premium).
 *
 * Il backend compila e salva il piano con pasti ed alimenti annidati
 * (datati oggi): qui si raccolgono solo i parametri e si mostra il
 * riepilogo. Nessun dato dei campi arriva dal client per il gating —
 * il flag premium è riletto sul server a ogni richiesta.
 */
export function GenerateDietModal({ visible, onClose }: Props) {
  const [goal, setGoal] = useState<string>(GOALS[0].key);
  const [dietType, setDietType] = useState<string>(DIET_TYPES[0]);
  const [mealsPerDay, setMealsPerDay] = useState<number>(MEALS_PER_DAY[1]);
  const [allergies, setAllergies] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiGeneratedDietPlan | null>(null);

  const generate = useGenerateDiet();

  function reset() {
    setGoal(GOALS[0].key);
    setDietType(DIET_TYPES[0]);
    setMealsPerDay(MEALS_PER_DAY[1]);
    setAllergies("");
    setError(null);
    setResult(null);
    generate.reset();
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleGenerate() {
    if (generate.isPending) return;
    setError(null);
    try {
      const plan = await generate.mutateAsync({
        goal: GOALS.find((option) => option.key === goal)?.label ?? goal,
        dietType,
        mealsPerDay,
        allergies: allergies
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      });
      setResult(plan);
    } catch (err) {
      setError(aiErrorMessage(err));
    }
  }

  const goalLabel = GOALS.find((option) => option.key === goal)?.label ?? goal;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === "web" ? "none" : "slide"}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View className="flex-1 justify-end bg-black/60">
        <View className="max-h-[92%] w-full rounded-t-3xl border-t border-border bg-surface">
          <View className="flex-row items-center gap-2 border-b border-border px-3 py-2">
            <Text className="flex-1 font-inter-bold text-base text-foreground">
              {result ? "Dieta generata" : "Genera dieta con AI"}
            </Text>
            <Pressable
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Chiudi"
              className="h-11 w-11 items-center justify-center rounded-lg active:opacity-60"
            >
              <X size={20} color="#94A3B8" strokeWidth={2.2} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 p-4 pb-8">
            {result ? (
              <View className="gap-4">
                <View className="items-center gap-2 py-2">
                  <View className="h-14 w-14 items-center justify-center rounded-full bg-accent/15">
                    <Check size={26} color="#22C55E" strokeWidth={2.5} />
                  </View>
                  <Text className="font-inter-bold text-lg text-foreground">{result.name}</Text>
                  <Text className="text-center font-sans text-sm text-muted">
                    {result.daily_calorie_target
                      ? `${result.daily_calorie_target} kcal/giorno · `
                      : ""}
                    {result.meals.length} pasti · P {result.protein_g ?? "—"} · C{" "}
                    {result.carbs_g ?? "—"} · G {result.fat_g ?? "—"}
                  </Text>
                </View>

                <View className="rounded-xl border border-border bg-background/40 p-4">
                  <Text className="font-inter-semibold text-sm text-foreground">
                    La dieta è già nel diario
                  </Text>
                  <Text className="mt-1 font-sans text-sm leading-5 text-muted">
                    I pasti generati sono datati oggi: li trovi sotto “Pasti” e puoi
                    modificarli uno per uno. Il piano resta nella lista come quello attivo.
                  </Text>
                </View>

                <Pressable
                  onPress={handleClose}
                  accessibilityRole="button"
                  className="cursor-pointer items-center rounded-xl bg-primary py-3.5 active:opacity-80"
                >
                  <Text className="font-inter-bold text-base text-primary-foreground">Fatto</Text>
                </Pressable>
              </View>
            ) : (
              <View className="gap-4">
                <Text className="font-sans text-sm leading-5 text-muted">
                  Rispondi alle quattro domande: l’AI compone una giornata bilanciata e salva
                  il piano. Funzione premium, l’uso è illimitato.
                </Text>

                <View className="gap-2">
                  <Text className="font-inter-semibold text-sm text-foreground">Obiettivo</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {GOALS.map((option) => (
                      <Chip
                        key={option.key}
                        label={option.label}
                        selected={goal === option.key}
                        onPress={() => setGoal(option.key)}
                      />
                    ))}
                  </View>
                </View>

                <View className="gap-2">
                  <Text className="font-inter-semibold text-sm text-foreground">Tipo di dieta</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {DIET_TYPES.map((option) => (
                      <Chip
                        key={option}
                        label={option}
                        selected={dietType === option}
                        onPress={() => setDietType(option)}
                      />
                    ))}
                  </View>
                </View>

                <View className="gap-2">
                  <Text className="font-inter-semibold text-sm text-foreground">Pasti al giorno</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {MEALS_PER_DAY.map((option) => (
                      <Chip
                        key={option}
                        label={`${option} pasti`}
                        selected={mealsPerDay === option}
                        onPress={() => setMealsPerDay(option)}
                      />
                    ))}
                  </View>
                </View>

                <View className="gap-1">
                  <Text className="font-sans text-xs text-muted">
                    Allergie o intolleranze (facoltativo, separate da virgola)
                  </Text>
                  <TextInput
                    value={allergies}
                    onChangeText={setAllergies}
                    placeholder="Es. lattosio, glutine, frutta secca"
                    placeholderTextColor="#64748B"
                    accessibilityLabel="Allergie o intolleranze"
                    className="rounded-lg border border-border bg-surface px-3 py-2.5 font-sans text-sm text-foreground"
                  />
                </View>

                {error ? (
                  <View className="gap-1 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
                    <Text className="font-inter-semibold text-sm text-destructive">
                      Generazione non riuscita
                    </Text>
                    <Text className="font-sans text-sm leading-5 text-muted">{error}</Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={handleGenerate}
                  disabled={generate.isPending}
                  accessibilityRole="button"
                  accessibilityLabel={`Genera dieta con AI per ${goalLabel}`}
                  className={`flex-row cursor-pointer items-center justify-center gap-2 rounded-xl py-3.5 ${
                    generate.isPending ? "bg-primary/40" : "bg-primary active:opacity-80"
                  }`}
                >
                  {generate.isPending ? (
                    <ActivityIndicator size="small" color="#0F172A" />
                  ) : (
                    <Sparkles size={18} color="#0F172A" strokeWidth={2.2} />
                  )}
                  <Text className="font-inter-bold text-base text-primary-foreground">
                    {generate.isPending ? "Generazione in corso…" : "Genera dieta"}
                  </Text>
                </Pressable>

                {generate.isPending ? (
                  <Text className="text-center font-sans text-xs text-muted">
                    Può volerci qualche decina di secondi.
                  </Text>
                ) : null}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
