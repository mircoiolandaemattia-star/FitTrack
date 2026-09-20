import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Clock, Search, X } from "lucide-react-native";
import type { CommonFood, DietFoodDraft } from "@/types";
import { searchCommonFoods } from "@/lib/commonFoods";
import { addRecentFood, getRecentFoods } from "@/lib/recentFoods";

type ManualFoodFormProps = {
  onAdd: (draft: DietFoodDraft) => void;
};

export function ManualFoodForm({ onAdd }: ManualFoodFormProps) {
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<DietFoodDraft[]>([]);
  const [selectedFood, setSelectedFood] = useState<CommonFood | null>(null);

  // Free form fields
  const [name, setName] = useState("");
  const [grams, setGrams] = useState("100");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fats, setFats] = useState("");

  useEffect(() => {
    getRecentFoods().then(setRecent);
  }, []);

  const results = useMemo(() => searchCommonFoods(query), [query]);
  const showRecent = !query.trim() && recent.length > 0 && !selectedFood;
  const gramsNum = parseFloat(grams.replace(",", ".")) || 0;

  // Quando seleziona un alimento comune, precompila
  function handleSelectCommon(food: CommonFood) {
    setSelectedFood(food);
    setName(food.name);
    setGrams("100");
    const factor = 1;
    setCalories(String(Math.round(food.caloriesPer100g * factor)));
    setProtein(String(food.proteinGPer100g));
    setCarbs(String(food.carbsGPer100g));
    setFats(String(food.fatsGPer100g));
    setQuery("");
  }

  function handleSelectRecent(item: DietFoodDraft) {
    setSelectedFood(null);
    setName(item.name);
    setGrams(String(item.quantityG));
    setCalories(String(item.calories));
    setProtein(String(item.proteinG));
    setCarbs(String(item.carbsG));
    setFats(String(item.fatsG));
  }

  function handleClearSelection() {
    setSelectedFood(null);
    setName("");
    setGrams("100");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFats("");
  }

  // Ricalcola da CommonFood quando cambia grams
  useEffect(() => {
    if (!selectedFood) return;
    const factor = gramsNum / 100;
    if (factor <= 0) return;
    setCalories(String(Math.round(selectedFood.caloriesPer100g * factor)));
    setProtein(String(Math.round(selectedFood.proteinGPer100g * factor * 10) / 10));
    setCarbs(String(Math.round(selectedFood.carbsGPer100g * factor * 10) / 10));
    setFats(String(Math.round(selectedFood.fatsGPer100g * factor * 10) / 10));
  }, [grams, gramsNum, selectedFood]);

  const canConfirm = name.trim().length > 1 && gramsNum > 0;

  function handleConfirm() {
    const draft: DietFoodDraft = {
      id: `manual-${Date.now()}`,
      name: name.trim(),
      quantityG: gramsNum,
      calories: parseInt(calories, 10) || 0,
      proteinG: parseFloat(protein.replace(",", ".")) || 0,
      carbsG: parseFloat(carbs.replace(",", ".")) || 0,
      fatsG: parseFloat(fats.replace(",", ".")) || 0,
    };
    addRecentFood(draft);
    onAdd(draft);
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4">
      {/* Ricerca */}
      <View className="gap-2">
        <View className="flex-row items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
          <Search size={18} color="#64748B" strokeWidth={2.2} />
          <TextInput
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              if (t.trim() === "") {
                // non resettare selezione qui
              }
            }}
            placeholder="Cerca alimento (es. pollo, riso, yogurt)"
            placeholderTextColor="#64748B"
            className="flex-1 font-sans text-sm text-foreground"
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8} className="p-1">
              <X size={16} color="#94A3B8" strokeWidth={2.2} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Recenti */}
      {showRecent ? (
        <View className="gap-2">
          <View className="flex-row items-center gap-1.5">
            <Clock size={14} color="#94A3B8" strokeWidth={2.2} />
            <Text className="font-inter-semibold text-xs uppercase tracking-wide text-muted">Usati di recente</Text>
          </View>
          <View className="gap-2">
            {recent.map((item) => (
              <Pressable key={item.id} onPress={() => handleSelectRecent(item)} className="rounded-xl border border-border bg-background/40 px-3 py-2.5 active:opacity-80">
                <Text className="font-inter-semibold text-sm text-foreground">{item.name}</Text>
                <Text className="font-sans text-xs text-muted">{item.quantityG}g · {item.calories} kcal</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* Risultati ricerca */}
      {query.trim().length > 0 ? (
        <View className="gap-2">
          {results.length === 0 ? (
            <View className="rounded-xl border border-border bg-background/20 p-4">
              <Text className="font-sans text-sm text-muted">Nessun alimento trovato. Compila il form qui sotto.</Text>
            </View>
          ) : (
            results.map((food) => (
              <Pressable key={food.id} onPress={() => handleSelectCommon(food)} className="flex-row items-center gap-3 rounded-xl border border-border bg-background/40 px-3 py-3 active:opacity-80">
                <View className="flex-1">
                  <Text className="font-inter-semibold text-sm text-foreground">{food.name}</Text>
                  <Text className="font-sans text-xs text-muted">{food.caloriesPer100g} kcal / 100g · P{food.proteinGPer100g} C{food.carbsGPer100g} G{food.fatsGPer100g}</Text>
                </View>
                <View className="rounded-full bg-primary/15 px-3 py-1.5">
                  <Text className="font-inter-semibold text-xs text-primary">Seleziona</Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      ) : null}

      {/* Form */}
      <View className="gap-3 rounded-xl border border-border bg-background/40 p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-inter-semibold text-sm text-foreground">{selectedFood ? "Quantità" : "Inserimento manuale"}</Text>
          {(selectedFood || name) ? (
            <Pressable onPress={handleClearSelection} className="rounded-full bg-surface px-3 py-1 active:opacity-80">
              <Text className="font-sans text-xs text-muted">Pulisci</Text>
            </Pressable>
          ) : null}
        </View>

        <View>
          <Text className="font-sans text-xs text-muted">Nome alimento *</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Es. Petto di pollo" placeholderTextColor="#64748B" className="mt-1 rounded-lg border border-border bg-surface px-3 py-2.5 font-sans text-sm text-foreground" />
        </View>

        <View>
          <Text className="font-sans text-xs text-muted">Quantità (g) *</Text>
          <TextInput value={grams} onChangeText={setGrams} keyboardType="numeric" placeholder="100" placeholderTextColor="#64748B" className="mt-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-center font-inter-semibold text-sm text-foreground" />
        </View>

        {!selectedFood ? (
          <>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Text className="font-sans text-xs text-muted">Calorie</Text>
                <TextInput value={calories} onChangeText={setCalories} keyboardType="numeric" placeholder="0" placeholderTextColor="#64748B" className="mt-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-center font-sans text-sm text-foreground" />
              </View>
              <View className="flex-1">
                <Text className="font-sans text-xs text-muted">Proteine (g)</Text>
                <TextInput value={protein} onChangeText={setProtein} keyboardType="numeric" placeholder="0" placeholderTextColor="#64748B" className="mt-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-center font-sans text-sm text-foreground" />
              </View>
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Text className="font-sans text-xs text-muted">Carboidrati (g)</Text>
                <TextInput value={carbs} onChangeText={setCarbs} keyboardType="numeric" placeholder="0" placeholderTextColor="#64748B" className="mt-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-center font-sans text-sm text-foreground" />
              </View>
              <View className="flex-1">
                <Text className="font-sans text-xs text-muted">Grassi (g)</Text>
                <TextInput value={fats} onChangeText={setFats} keyboardType="numeric" placeholder="0" placeholderTextColor="#64748B" className="mt-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-center font-sans text-sm text-foreground" />
              </View>
            </View>
          </>
        ) : (
          <View className="rounded-lg bg-surface px-3 py-3">
            <Text className="text-center font-sans text-xs text-muted">Valori ricalcolati per {gramsNum}g</Text>
            <Text className="mt-1 text-center font-inter-bold text-sm text-foreground">
              {calories} kcal · P {protein}g · C {carbs}g · G {fats}g
            </Text>
          </View>
        )}
      </View>

      <Pressable onPress={handleConfirm} disabled={!canConfirm} className={`items-center rounded-xl py-3.5 ${!canConfirm ? "bg-primary/40 opacity-60" : "bg-primary active:opacity-80"}`}>
        <Text className="font-inter-bold text-base text-primary-foreground">Conferma e aggiungi</Text>
      </Pressable>
      <Text className="text-center font-sans text-xs text-muted">Sempre disponibile, nessun limite</Text>
    </ScrollView>
  );
}
