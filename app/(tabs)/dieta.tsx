import { useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { ChevronLeft, ChevronRight, RefreshCw, Sparkles, UtensilsCrossed } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/home/Card";
import { MacroProgressBar } from "@/components/dieta/MacroProgressBar";
import { MealSection } from "@/components/dieta/MealSection";
import { AddFoodModal, type FoodSource } from "@/components/dieta/AddFoodModal";
import { GenerateDietModal } from "@/components/dieta/GenerateDietModal";
import { useIsStandalone } from "@/lib/useStandalone";
import { isApiError } from "@/lib/api";
import { useProfile } from "@/lib/profileQueries";
import { addDays, dateToString, formatDayLabel, type MealType } from "@/lib/dietaStore";
import {
  useAddFoodItems,
  useDeleteFoodItem,
  useDiaryDay,
  useDietPlans,
  useUpdateFoodItem,
} from "@/lib/dietQueries";
import type { DietFoodDraft } from "@/types";

const WIDE_BREAKPOINT = 768;

/** Messaggio d'errore leggibile: quello dell'API o una rete assente. */
function errorMessage(error: unknown): string {
  return isApiError(error) ? error.message : "Connessione al server non riuscita.";
}

/**
 * Dieta: diario del giorno (pasti + alimenti) e macro dal backend
 * (meals/food_items con React Query), target dal profilo (users), piano
 * attivo da diet-plans. Tutte le inserzioni sono collegate: manuale,
 * foto+AI, codice a barre, importazione di un file e generazione della
 * dieta con AI (ultime due funzioni premium).
 */
export default function DietaScreen() {
  const { width } = useWindowDimensions();
  const isStandalone = useIsStandalone();
  const isWide = width >= WIDE_BREAKPOINT;
  const isReadOnly = Platform.OS === "web" && !isStandalone;

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    Colazione: true,
    Pranzo: false,
    Cena: false,
    Snack: false,
  });
  const [addMealType, setAddMealType] = useState<MealType | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Editing state
  const [editing, setEditing] = useState<{
    mealId: string;
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
    mealId: string;
    mealType: MealType;
    foodId: string;
    name: string;
  } | null>(null);

  const dateStr = useMemo(() => dateToString(selectedDate), [selectedDate]);
  const dayLabel = useMemo(() => formatDayLabel(selectedDate), [selectedDate]);

  // Dati reali: diario del giorno, piani dieta, profilo (target TDEE).
  const diary = useDiaryDay(dateStr);
  const plansQuery = useDietPlans();
  const profileQuery = useProfile();
  const plans = plansQuery.data ?? [];
  const activePlan = plans.find((plan) => plan.is_active) ?? plans[0] ?? null;

  const addFood = useAddFoodItems();
  const updateFood = useUpdateFoodItem();
  const deleteFood = useDeleteFoodItem();

  const meals = diary.meals;
  const totals = diary.totals;

  // Target: profilo (users/me) con fallback sui target del piano attivo.
  const profile = profileQuery.data;
  const targetCalories = profile?.daily_calorie_target ?? activePlan?.daily_calorie_target ?? 0;
  const targetProtein = profile?.protein_target_g ?? activePlan?.protein_g ?? 0;
  const targetCarbs = profile?.carbs_target_g ?? activePlan?.carbs_g ?? 0;
  const targetFats = profile?.fat_target_g ?? activePlan?.fat_g ?? 0;

  const isLoading = diary.isLoading || plansQuery.isLoading || profileQuery.isLoading;
  const isError = diary.isError || plansQuery.isError;
  const error = diary.error ?? plansQuery.error;

  function refetch() {
    if (diary.isError) diary.refetch();
    if (plansQuery.isError) void plansQuery.refetch();
  }

  function toggleMeal(type: MealType) {
    setExpanded((prev) => ({ ...prev, [type]: !prev[type] }));
  }

  async function handleAddFood(drafts: DietFoodDraft[], source: FoodSource) {
    if (!addMealType || drafts.length === 0) return;
    setSaveError(null);
    try {
      // Il pasto viene creato al primo inserimento (POST /meals), poi gli
      // alimenti in serie: Foto+AI conferma una lista, il manuale un solo voce.
      await addFood.mutateAsync({ date: dateStr, mealType: addMealType, drafts, source });
    } catch (err) {
      setSaveError(errorMessage(err));
    }
  }

  function handleRequestEdit(mealType: MealType, foodId: string) {
    const meal = meals.find((m) => m.type === mealType);
    const item = meal?.foodItems.find((f) => f.id === foodId);
    if (!item || !meal) return;
    setEditing({
      mealId: meal.id,
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
    setSaveError(null);
    // La quantità riscala calorie e macro, come in precedenza.
    updateFood.mutate(
      {
        foodId: editing.foodId,
        mealId: editing.mealId,
        patch: {
          quantityG: newQty,
          calories: Math.round(editing.originalCalories * factor),
          proteinG: Math.round(editing.originalProtein * factor * 10) / 10,
          carbsG: Math.round(editing.originalCarbs * factor * 10) / 10,
          fatsG: Math.round(editing.originalFats * factor * 10) / 10,
        },
      },
      { onError: (err) => setSaveError(errorMessage(err)) },
    );
    setEditing(null);
  }

  function handleDelete(mealType: MealType, foodId: string) {
    const meal = meals.find((m) => m.type === mealType);
    const item = meal?.foodItems.find((f) => f.id === foodId);
    if (!item || !meal) return;
    setDeleteConfirm({ mealId: meal.id, mealType, foodId, name: item.name });
  }

  function confirmDelete() {
    if (!deleteConfirm) return;
    setSaveError(null);
    deleteFood.mutate(
      { foodId: deleteConfirm.foodId, mealId: deleteConfirm.mealId },
      { onError: (err) => setSaveError(errorMessage(err)) },
    );
    setDeleteConfirm(null);
  }

  function handleGeneratePress() {
    setGenerateOpen(true);
  }

  const planCard = activePlan ? (
    <Card className="flex-row items-center gap-3 p-4">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
        <UtensilsCrossed size={18} color="#F97316" strokeWidth={2.2} />
      </View>
      <View className="flex-1">
        <Text className="font-inter-semibold text-base text-foreground" numberOfLines={1}>
          {activePlan.name}
        </Text>
        <Text className="mt-0.5 font-sans text-xs text-muted">
          Piano attivo
          {activePlan.daily_calorie_target ? ` · ${activePlan.daily_calorie_target} kcal/giorno` : ""}
        </Text>
      </View>
    </Card>
  ) : (
    <Card className="p-4">
      <Text className="font-inter-semibold text-sm text-foreground">Nessun piano dieta</Text>
      <Text className="mt-0.5 font-sans text-xs text-muted">
        I target qui sotto arrivano dal tuo profilo: puoi aggiungere i pasti anche senza un piano.
      </Text>
    </Card>
  );

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
          {Math.round(totals.calories)} / {targetCalories > 0 ? targetCalories : "—"} kcal
        </Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-background">
        <View
          className="h-2 rounded-full bg-primary"
          style={{
            width: `${targetCalories > 0 ? Math.min(100, Math.round((totals.calories / targetCalories) * 100)) : 0}%`,
          }}
        />
      </View>
      <View className="gap-3">
        <MacroProgressBar label="Proteine" current={totals.proteinG} target={targetProtein} color="#F97316" />
        <MacroProgressBar label="Carboidrati" current={totals.carbsG} target={targetCarbs} color="#22C55E" />
        <MacroProgressBar label="Grassi" current={totals.fatsG} target={targetFats} color="#38BDF8" />
      </View>
    </Card>
  );

  function mealSection(meal: (typeof meals)[number]) {
    return (
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
    );
  }

  const mealsList = <View className="gap-3">{meals.map(mealSection)}</View>;

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

  const saveErrorBanner = saveError ? (
    <Card className="gap-1 p-4">
      <Text className="font-inter-semibold text-sm text-destructive">Operazione non riuscita</Text>
      <Text className="font-sans text-sm leading-5 text-muted">{saveError}</Text>
    </Card>
  ) : null;

  /** Contenuto sotto l'header: loading, errore o dati. */
  let body: ReactNode;
  if (isLoading) {
    body = (
      <View className="items-center gap-3 py-10">
        <ActivityIndicator color="#F97316" />
        <Text className="font-sans text-sm text-muted">Caricamento della dieta…</Text>
      </View>
    );
  } else if (isError) {
    body = (
      <Card className="items-center gap-3 p-6">
        <Text className="font-inter-semibold text-base text-foreground">Impossibile caricare la dieta</Text>
        <Text className="text-center font-sans text-sm text-muted">{errorMessage(error)}</Text>
        {!isReadOnly ? (
          <Pressable
            onPress={refetch}
            accessibilityRole="button"
            className="mt-1 flex-row items-center gap-1.5 rounded-xl bg-primary px-5 py-3 active:opacity-80"
          >
            <RefreshCw size={16} color="#0F172A" strokeWidth={2.5} />
            <Text className="font-inter-bold text-sm text-primary-foreground">Riprova</Text>
          </Pressable>
        ) : null}
      </Card>
    );
  } else {
    const mealsSection = (
      <View className="gap-3">
        <Text className="font-inter-semibold text-base text-foreground">Pasti</Text>
        {mealsList}
      </View>
    );
    body = (
      <View className="w-full gap-6">
        {saveErrorBanner}
        {planCard}
        {isWide ? (
          <View className="w-full flex-row items-start gap-6">
            <View className="flex-1 gap-6">
              {macroCard}
              <View className="gap-3">
                <Text className="font-inter-semibold text-base text-foreground">Pasti</Text>
                <View className="gap-3">{meals.slice(0, 2).map(mealSection)}</View>
              </View>
            </View>
            <View className="flex-1 gap-6">
              <View className="gap-3">
                <Text className="font-inter-semibold text-base text-foreground invisible">Pasti</Text>
                <View className="gap-3 pt-0">{meals.slice(2).map(mealSection)}</View>
              </View>
              {generateButton}
            </View>
          </View>
        ) : (
          <>
            {macroCard}
            {mealsSection}
            {generateButton}
          </>
        )}
      </View>
    );
  }

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

        {body}
      </ScrollView>

      {/* Modal aggiunta alimento (manuale, foto+AI, barcode e file collegati) */}
      <AddFoodModal visible={Boolean(addMealType)} mealType={addMealType} onClose={() => setAddMealType(null)} onAdd={handleAddFood} />

      {/* Modal generazione dieta (premium): montato solo quando aperto,
          così ogni apertura riparte dal form pulito */}
      {generateOpen ? <GenerateDietModal visible onClose={() => setGenerateOpen(false)} /> : null}

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
