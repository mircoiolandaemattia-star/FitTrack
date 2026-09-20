import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Check, Sparkles } from "lucide-react-native";
import type { DietDraft } from "@/types";
import { applyDietDraft, buildMockDietDraft } from "@/lib/dietaStore";

const GOAL_OPTIONS = [
  { key: "dimagrire", label: "Dimagrire" },
  { key: "mantenimento", label: "Mantenimento" },
  { key: "massa", label: "Massa muscolare" },
] as const;

const ALLERGY_CHIPS = ["Glutine", "Lattosio", "Frutta secca", "Uova", "Pesce", "Crostacei", "Soia"];

const DIET_TYPE_OPTIONS = [
  { key: "onnivoro", label: "Onnivoro" },
  { key: "vegetariano", label: "Vegetariano" },
  { key: "vegano", label: "Vegano" },
  { key: "pescatariano", label: "Pescatariano" },
] as const;

const MEALS_OPTIONS = [3, 4, 5] as const;

function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className={`rounded-full border px-4 py-2.5 active:opacity-80 ${selected ? "border-primary bg-primary/15" : "border-border bg-surface"}`}>
      <Text className={`font-inter-semibold text-sm ${selected ? "text-primary" : "text-muted"}`}>{label}</Text>
    </Pressable>
  );
}

type GenerateDietFlowProps = {
  onDone: () => void;
};

export function GenerateDietFlow({ onDone }: GenerateDietFlowProps) {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<"dimagrire" | "mantenimento" | "massa">("mantenimento");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [customAllergy, setCustomAllergy] = useState("");
  const [dietType, setDietType] = useState<"onnivoro" | "vegetariano" | "vegano" | "pescatariano">("onnivoro");
  const [mealsPerDay, setMealsPerDay] = useState<3 | 4 | 5>(4);
  const [phase, setPhase] = useState<"form" | "loading" | "result">("form");
  const [draft, setDraft] = useState<DietDraft | null>(null);
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null);

  function toggleAllergy(label: string) {
    setAllergies((prev) => (prev.includes(label) ? prev.filter((a) => a !== label) : [...prev, label]));
  }

  function handleNext() {
    if (step < 3) setStep(step + 1);
    else {
      setPhase("loading");
      setTimeout(() => {
        setDraft(buildMockDietDraft());
        setPhase("result");
      }, 2200);
    }
  }

  function handleBack() {
    if (step > 0) setStep(step - 1);
  }

  function handleSave() {
    if (draft) applyDietDraft(draft);
    onDone();
  }

  if (phase === "loading") {
    return (
      <View className="items-center gap-3 py-10">
        <ActivityIndicator size="large" color="#F97316" />
        <Text className="font-inter-semibold text-base text-foreground">L'AI sta creando la tua dieta...</Text>
        <Text className="text-center font-sans text-sm text-muted">Piano settimanale su misura per i tuoi obiettivi</Text>
      </View>
    );
  }

  if (phase === "result" && draft) {
    return (
      <ScrollView contentContainerClassName="gap-4">
        <View className="items-center gap-2 py-2">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-accent/15">
            <Check size={26} color="#22C55E" strokeWidth={2.5} />
          </View>
          <Text className="font-inter-bold text-lg text-foreground">{draft.name}</Text>
          <Text className="font-sans text-xs text-muted">7 giorni · {mealsPerDay} pasti al giorno · {dietType}</Text>
        </View>
        <View className="gap-2">
          {draft.days.map((day, idx) => {
            const isExpanded = expandedDayId === day.id;
            const dayCalories = day.meals.reduce((s, m) => s + m.foodItems.reduce((a, f) => a + f.calories, 0), 0);
            return (
              <View key={day.id} className="rounded-xl border border-border bg-background/40 p-3">
                <Pressable onPress={() => setExpandedDayId(isExpanded ? null : day.id)} className="flex-row items-center gap-2">
                  <Text className="h-6 w-6 text-center font-inter-semibold text-xs text-muted">{idx + 1}</Text>
                  <View className="flex-1">
                    <Text className="font-inter-semibold text-sm text-foreground">
                      Giorno {idx + 1} · {new Date(day.date).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" })}
                    </Text>
                    <Text className="font-sans text-xs text-muted">{dayCalories} kcal · {day.meals.length} pasti</Text>
                  </View>
                  <Text className="font-inter-semibold text-xs text-primary">{isExpanded ? "Chiudi" : "Apri"}</Text>
                </Pressable>
                {isExpanded ? (
                  <View className="mt-3 gap-2">
                    {day.meals.map((meal) => (
                      <View key={meal.id} className="rounded-lg bg-surface px-3 py-2">
                        <Text className="font-inter-semibold text-xs text-foreground">{meal.type}</Text>
                        {meal.foodItems.map((f) => (
                          <Text key={f.id} className="font-sans text-xs text-muted">
                            • {f.name} · {f.quantityG}g · {f.calories} kcal
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
        <Pressable onPress={handleSave} className="flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3.5 active:opacity-80">
          <Sparkles size={18} color="#0F172A" strokeWidth={2.2} />
          <Text className="font-inter-bold text-base text-primary-foreground">Salva dieta</Text>
        </Pressable>
        <Pressable onPress={() => setPhase("form")} className="items-center rounded-xl border border-border bg-background/60 py-3 active:opacity-80">
          <Text className="font-inter-semibold text-sm text-muted">Rigenera</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <View className="gap-5">
      <View className="flex-row items-center justify-between">
        <Text className="font-sans text-xs text-muted">Passo {step + 1} di 4</Text>
        <Text className="font-inter-semibold text-sm text-foreground">
          {["Obiettivo", "Allergie", "Preferenze", "Numero pasti"][step]}
        </Text>
      </View>

      {step === 0 ? (
        <View className="gap-2">
          <Text className="font-inter-semibold text-sm text-foreground">Qual è il tuo obiettivo?</Text>
          <View className="flex-row flex-wrap gap-2">
            {GOAL_OPTIONS.map((o) => (
              <Chip key={o.key} label={o.label} selected={goal === o.key} onPress={() => setGoal(o.key)} />
            ))}
          </View>
        </View>
      ) : null}

      {step === 1 ? (
        <View className="gap-3">
          <Text className="font-inter-semibold text-sm text-foreground">Hai allergie o intolleranze?</Text>
          <View className="flex-row flex-wrap gap-2">
            {ALLERGY_CHIPS.map((a) => (
              <Chip key={a} label={a} selected={allergies.includes(a)} onPress={() => toggleAllergy(a)} />
            ))}
          </View>
          <TextInput
            value={customAllergy}
            onChangeText={setCustomAllergy}
            placeholder="Altro (es. sedano, senape) — campo libero"
            placeholderTextColor="#64748B"
            className="rounded-xl border border-border bg-surface px-3 py-3 font-sans text-sm text-foreground"
          />
        </View>
      ) : null}

      {step === 2 ? (
        <View className="gap-2">
          <Text className="font-inter-semibold text-sm text-foreground">Preferenze alimentari</Text>
          <View className="flex-row flex-wrap gap-2">
            {DIET_TYPE_OPTIONS.map((o) => (
              <Chip key={o.key} label={o.label} selected={dietType === o.key} onPress={() => setDietType(o.key as typeof dietType)} />
            ))}
          </View>
        </View>
      ) : null}

      {step === 3 ? (
        <View className="gap-2">
          <Text className="font-inter-semibold text-sm text-foreground">Quanti pasti al giorno?</Text>
          <View className="flex-row gap-2">
            {MEALS_OPTIONS.map((n) => (
              <Pressable key={n} onPress={() => setMealsPerDay(n)} className={`flex-1 items-center rounded-xl border py-4 active:opacity-80 ${mealsPerDay === n ? "border-primary bg-primary/15" : "border-border bg-surface"}`}>
                <Text className={`font-inter-bold text-2xl ${mealsPerDay === n ? "text-primary" : "text-foreground"}`}>{n}</Text>
                <Text className="font-sans text-xs text-muted">pasti</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View className="flex-row gap-2">
        {step > 0 ? (
          <Pressable onPress={handleBack} className="items-center rounded-xl border border-border bg-background/60 px-5 py-3.5 active:opacity-80">
            <Text className="font-inter-semibold text-base text-muted">Indietro</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={handleNext} className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3.5 active:opacity-80">
          {step === 3 ? <Sparkles size={18} color="#0F172A" strokeWidth={2.2} /> : null}
          <Text className="font-inter-bold text-base text-primary-foreground">{step === 3 ? "Genera dieta" : "Avanti"}</Text>
        </Pressable>
      </View>
    </View>
  );
}
