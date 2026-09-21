import { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  UtensilsCrossed,
  X,
} from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/home/Card";
import { MacroProgressBar } from "@/components/dieta/MacroProgressBar";
import { MealSection } from "@/components/dieta/MealSection";
import { AddFoodModal } from "@/components/dieta/AddFoodModal";
import { GenerateDietFlow } from "@/components/dieta/GenerateDietFlow";
import { PremiumUpsellModal } from "@/components/dieta/PremiumUpsellModal";
import { useAuth } from "@/lib/auth";
import { useIsStandalone } from "@/lib/useStandalone";
import {
  addDays,
  addFoodToMeal,
  dateToString,
  DIET_TARGETS,
  formatDayLabel,
  getDietTotals,
  getMealsForDate,
  MEAL_TYPES,
  removeFoodFromMeal,
  updateFoodInMeal,
  type MealType,
} from "@/lib/dietaStore";
import type { DietFoodDraft } from "@/types";

const WIDE_BREAKPOINT = 768;

export default function DietaScreen() {
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const isStandalone = useIsStandalone();
  const isWide = width >= WIDE_BREAKPOINT;
  const isReadOnly = Platform.OS === "web" && !isStandalone;
  const isPremium = Boolean(user?.isPremium || user?.isTrial);

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [version, setVersion] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    Colazione: true,
    Pranzo: false,
    Cena: false,
    Snack: false,
  });
  const [addMealType, setAddMealType] = useState<MealType | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showGenerateUpsell, setShowGenerateUpsell] = useState(false);

  // Editing state
  const [editing, setEditing] = useState<{
    mealType: MealType;
    foodId: string;
    name: string;
    quantityG: string;
    originalQuantity: number;
    originalCalories: number;
    originalProtein: number;
    originalCarbs: number;
    originalFats: number;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    mealType: MealType;
    foodId: string;
    name: string;
  } | null>(null);

  const dateStr = useMemo(() => dateToString(selectedDate), [selectedDate]);
  // Force recompute when version changes
  const meals = useMemo(() => getMealsForDate(dateStr), [dateStr, version]);
  const totals = useMemo(() => getDietTotals(dateStr), [dateStr, version]);
  const dayLabel = useMemo(() => formatDayLabel(selectedDate), [selectedDate]);

  function bump() {
    setVersion((v) => v + 1);
  }

  function toggleMeal(type: MealType) {
    setExpanded((prev) => ({ ...prev, [type]: !prev[type] }));
  }

  function handleAddFood(draft: DietFoodDraft) {
    if (!addMealType) return;
    addFoodToMeal(dateStr, addMealType, draft);
    bump();
    setAddMealType(null);
  }

  function handleRequestEdit(mealType: MealType, foodId: string) {
    const meal = meals.find((m) => m.type === mealType);
    const item = meal?.foodItems.find((f) => f.id === foodId);
    if (!item) return;
    setEditing({
      mealType,
      foodId,
      name: item.name,
      quantityG: String(item.quantityG),
      originalQuantity: item.quantityG,
      originalCalories: item.calories,
      originalProtein: item.proteinG,
      originalCarbs: item.carbsG,
      originalFats: item.fatsG,
    });
  }

  function handleConfirmEdit() {
    if (!editing) return;
    const newQty = parseFloat(editing.quantityG.replace(",", ".")) || 0;
    if (newQty <= 0) return;
    const factor = newQty / (editing.originalQuantity || 1);
    updateFoodInMeal(dateStr, editing.mealType, editing.foodId, {
      quantityG: newQty,
      calories: Math.round(editing.originalCalories * factor),
      proteinG: Math.round(editing.originalProtein * factor * 10) / 10,
      carbsG: Math.round(editing.originalCarbs * factor * 10) / 10,
      fatsG: Math.round(editing.originalFats * factor * 10) / 10,
    });
    setEditing(null);
    bump();
  }

  function handleDelete(foodMealType: MealType, foodId: string) {
    setDeleteConfirm({ mealType: foodMealType, foodId, name: meals.find((m) => m.type === foodMealType)?.foodItems.find((f) => f.id === foodId)?.name ?? "" });
  }

  function confirmDelete() {
    if (!deleteConfirm) return;
    removeFoodFromMeal(dateStr, deleteConfirm.mealType, deleteConfirm.foodId);
    setDeleteConfirm(null);
    bump();
  }

  function handleGeneratePress() {
    if (!isPremium) {
      setShowGenerateUpsell(true);
      return;
    }
    setShowGenerate(true);
  }

  const macroCard = (
    <Card className="gap-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
            <UtensilsCrossed size={18} color="#F97316" strokeWidth={2.2} />
          </View>
          <Text className="font-inter-semibold text-sm text-foreground">Riepilogo giornaliero</Text>
        </View>
        <Text className="font-inter-bold text-sm text-foreground">
          {Math.round(totals.calories)} / {DIET_TARGETS.calories} kcal
        </Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-background">
        <View
          className="h-2 rounded-full bg-primary"
          style={{ width: `${Math.min(100, Math.round((totals.calories / DIET_TARGETS.calories) * 100))}%` }}
        />
      </View>
      <View className="gap-3">
        <MacroProgressBar label="Proteine" current={totals.proteinG} target={DIET_TARGETS.proteinG} color="#F97316" />
        <MacroProgressBar label="Carboidrati" current={totals.carbsG} target={DIET_TARGETS.carbsG} color="#22C55E" />
        <MacroProgressBar label="Grassi" current={totals.fatsG} target={DIET_TARGETS.fatsG} color="#38BDF8" />
      </View>
    </Card>
  );

  const mealsList = (
    <View className="gap-3">
      {meals.map((meal) => (
        <MealSection
          key={meal.id}
          meal={meal}
          expanded={Boolean(expanded[meal.type])}
          onToggle={() => toggleMeal(meal.type as MealType)}
          onAdd={() => setAddMealType(meal.type as MealType)}
          onEditFood={(fid) => handleRequestEdit(meal.type as MealType, fid)}
          onDeleteFood={(fid) => handleDelete(meal.type as MealType, fid)}
          readOnly={isReadOnly}
        />
      ))}
    </View>
  );

  const generateButton = !isReadOnly ? (
    <Pressable
      onPress={handleGeneratePress}
      className="flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-4 active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel="Genera dieta con AI"
    >
      <Sparkles size={18} color="#0F172A" strokeWidth={2.2} />
      <Text className="font-inter-bold text-base text-primary-foreground">Genera dieta con AI</Text>
    </Pressable>
  ) : (
    <View className="rounded-2xl border border-border bg-surface px-4 py-3">
      <Text className="text-center font-sans text-sm text-muted">
        {Platform.OS === "web" && !isStandalone ? "Sola lettura su browser — installa la PWA o usa l'app mobile per modificare" : "Sola lettura"}
      </Text>
    </View>
  );

  return (
    <Screen>
      <ScrollView className="flex-1" contentContainerClassName={`w-full gap-6 px-4 py-6 ${isWide ? "mx-auto max-w-5xl px-6" : ""}`}>
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <Text className="font-inter-bold text-3xl text-foreground">Dieta</Text>
          <View className="flex-row items-center gap-2 rounded-full border border-border bg-surface px-1 py-1">
            <Pressable
              onPress={() => setSelectedDate((d) => addDays(d, -1))}
              accessibilityRole="button"
              accessibilityLabel="Giorno precedente"
              className="h-9 w-9 items-center justify-center rounded-full bg-background active:opacity-60"
            >
              <ChevronLeft size={18} color="#F8FAFC" strokeWidth={2.2} />
            </Pressable>
            <Text className="min-w-[90px] text-center font-inter-semibold text-sm text-foreground">{dayLabel}</Text>
            <Pressable
              onPress={() => setSelectedDate((d) => addDays(d, 1))}
              accessibilityRole="button"
              accessibilityLabel="Giorno successivo"
              className="h-9 w-9 items-center justify-center rounded-full bg-background active:opacity-60"
            >
              <ChevronRight size={18} color="#F8FAFC" strokeWidth={2.2} />
            </Pressable>
          </View>
        </View>

        {isWide ? (
          <View className="w-full flex-row items-start gap-6">
            <View className="flex-1 gap-6">
              {macroCard}
              <View className="gap-3">
                <Text className="font-inter-semibold text-base text-foreground">Pasti</Text>
                <View className="gap-3">
                  {meals.slice(0, 2).map((meal) => (
                    <MealSection
                      key={meal.id}
                      meal={meal}
                      expanded={Boolean(expanded[meal.type])}
                      onToggle={() => toggleMeal(meal.type as MealType)}
                      onAdd={() => setAddMealType(meal.type as MealType)}
                      onEditFood={(fid) => handleRequestEdit(meal.type as MealType, fid)}
                      onDeleteFood={(fid) => handleDelete(meal.type as MealType, fid)}
                      readOnly={isReadOnly}
                    />
                  ))}
                </View>
              </View>
            </View>
            <View className="flex-1 gap-6">
              <View className="gap-3">
                <Text className="font-inter-semibold text-base text-foreground hidden">Pasti</Text>
                <View className="gap-3 pt-0">
                  {meals.slice(2).map((meal) => (
                    <MealSection
                      key={meal.id}
                      meal={meal}
                      expanded={Boolean(expanded[meal.type])}
                      onToggle={() => toggleMeal(meal.type as MealType)}
                      onAdd={() => setAddMealType(meal.type as MealType)}
                      onEditFood={(fid) => handleRequestEdit(meal.type as MealType, fid)}
                      onDeleteFood={(fid) => handleDelete(meal.type as MealType, fid)}
                      readOnly={isReadOnly}
                    />
                  ))}
                </View>
              </View>
              {generateButton}
            </View>
          </View>
        ) : (
          <>
            {macroCard}
            <View className="gap-3">
              <Text className="font-inter-semibold text-base text-foreground">Pasti</Text>
              {mealsList}
            </View>
            {generateButton}
          </>
        )}
      </ScrollView>

      {/* Modal aggiunta alimento */}
      <AddFoodModal visible={Boolean(addMealType)} mealType={addMealType} onClose={() => setAddMealType(null)} onAdd={handleAddFood} isPremium={isPremium} />

      {/* Modal genera dieta con AI */}
      <Modal visible={showGenerate} transparent animationType={Platform.OS === "web" ? "none" : "slide"} onRequestClose={() => setShowGenerate(false)} statusBarTranslucent>
        <View className="flex-1 justify-end bg-black/60">
          <View className="max-h-[92%] w-full rounded-t-3xl border-t border-border bg-surface" style={{ maxHeight: "92%" }}>
            <View className="flex-row items-center gap-2 border-b border-border px-3 py-2">
              <Text className="flex-1 font-inter-bold text-lg text-foreground">Genera dieta con AI</Text>
              <Pressable onPress={() => setShowGenerate(false)} className="h-11 w-11 items-center justify-center rounded-lg active:opacity-60">
                <X size={20} color="#94A3B8" strokeWidth={2.2} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 p-4 pb-8">
              <GenerateDietFlow
                onDone={() => {
                  setShowGenerate(false);
                  bump();
                }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <PremiumUpsellModal
        visible={showGenerateUpsell}
        onClose={() => setShowGenerateUpsell(false)}
        title="Genera dieta con AI — Premium"
        description="La generazione AI della dieta è disponibile solo per utenti Premium o in prova. Passa a Premium per creare il tuo piano settimanale su misura."
      />

      {/* Modal modifica quantità */}
      <Modal visible={Boolean(editing)} transparent animationType={Platform.OS === "web" ? "none" : "fade"} onRequestClose={() => setEditing(null)} statusBarTranslucent>
        <View className="flex-1 items-center justify-center bg-black/60 px-4">
          <View className="w-full max-w-md rounded-2xl border border-border bg-surface p-5">
            <Text className="font-inter-bold text-base text-foreground">Modifica quantità</Text>
            <Text className="mt-1 font-sans text-sm text-muted" numberOfLines={1}>
              {editing?.name}
            </Text>
            <View className="mt-4 gap-2">
              <Text className="font-sans text-xs text-muted">Quantità (g)</Text>
              <TextInput
                value={editing?.quantityG ?? ""}
                onChangeText={(t) => setEditing((prev) => (prev ? { ...prev, quantityG: t } : prev))}
                keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                placeholder="0"
                placeholderTextColor="#64748B"
                className="rounded-xl border border-border bg-background px-3 py-3 text-center font-inter-semibold text-base text-foreground"
              />
              <Text className="text-center font-sans text-xs text-muted">Le calorie e i macro verranno ricalcolati proporzionalmente</Text>
            </View>
            <View className="mt-5 flex-row gap-2">
              <Pressable onPress={() => setEditing(null)} className="flex-1 items-center rounded-xl border border-border bg-background/60 py-3 active:opacity-80">
                <Text className="font-inter-semibold text-sm text-muted">Annulla</Text>
              </Pressable>
              <Pressable onPress={handleConfirmEdit} className="flex-1 items-center rounded-xl bg-primary py-3 active:opacity-80">
                <Text className="font-inter-bold text-sm text-primary-foreground">Salva</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Conferma eliminazione */}
      <Modal visible={Boolean(deleteConfirm)} transparent animationType={Platform.OS === "web" ? "none" : "fade"} onRequestClose={() => setDeleteConfirm(null)} statusBarTranslucent>
        <View className="flex-1 items-center justify-center bg-black/60 px-4">
          <View className="w-full max-w-md rounded-2xl border border-border bg-surface p-5">
            <Text className="font-inter-bold text-base text-foreground">Eliminare questo alimento?</Text>
            <Text className="mt-1 font-sans text-sm text-muted" numberOfLines={2}>
              {deleteConfirm?.name}
            </Text>
            <View className="mt-5 flex-row gap-2">
              <Pressable onPress={() => setDeleteConfirm(null)} className="flex-1 items-center rounded-xl border border-border bg-background/60 py-3 active:opacity-80">
                <Text className="font-inter-semibold text-sm text-muted">Annulla</Text>
              </Pressable>
              <Pressable onPress={confirmDelete} className="flex-1 items-center rounded-xl bg-destructive py-3 active:opacity-80">
                <Text className="font-inter-bold text-sm text-white">Elimina</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
