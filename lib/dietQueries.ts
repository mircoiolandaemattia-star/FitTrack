import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "./api";
import { MEAL_TYPES, type MealType } from "./dietaStore";
import type { DietFoodDraft, FoodItem, Meal } from "@/types";

/**
 * Dieta su backend reale (diet_plans, meals, food_items).
 *
 * Struttura dei dati:
 * - `GET /diet-plans` torna una lista PIATTA (il dettaglio `:id` non aggiunge
 *   nulla, non ha annidamenti): il "piano attivo" si ricava da `is_active`.
 * - `GET /meals?date=` torna i pasti SENZA alimenti: i totali giornalieri si
 *   calcolano con `GET /food-items?meal_id=` per ogni pasto (una query per
 *   pasto, gestita da `useQueries`).
 * - Il backend non conosce i pasti "di default": se per una data non esiste
 *   ancora un pasto di un certo tipo, il primo inserimento lo crea
 *   (`POST /meals`) e ci aggancia l'alimento (`POST /food-items`).
 */

/** Enum `meal_type` del backend. */
export type ApiMealType = "breakfast" | "lunch" | "dinner" | "snack";

/** Riga `diet_plans` (colonne proprie dei target, nullable). */
export interface ApiDietPlan {
  id: string;
  user_id: string;
  name: string;
  source: string;
  is_active: boolean;
  daily_calorie_target: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  created_at: string;
}

/** Riga `meals`: niente alimenti annidati. */
export interface ApiMeal {
  id: string;
  user_id: string;
  diet_plan_id: string | null;
  meal_type: ApiMealType;
  date: string;
  name: string | null;
  created_at: string;
}

/** Riga `food_items`. */
export interface ApiFoodItem {
  id: string;
  meal_id: string;
  name: string;
  quantity_g: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source: string;
  barcode: string | null;
  photo_url: string | null;
  created_at: string;
}

/* --------------------------- Mappature etichette --------------------------- */

/** Etichetta UI (colonna `type` del modello `Meal` dell'app) → enum API. */
export const MEAL_TYPE_TO_API: Record<MealType, ApiMealType> = {
  Colazione: "breakfast",
  Pranzo: "lunch",
  Cena: "dinner",
  Snack: "snack",
};

const API_MEAL_TYPE_TO_LABEL: Record<ApiMealType, MealType> = {
  breakfast: "Colazione",
  lunch: "Pranzo",
  dinner: "Cena",
  snack: "Snack",
};

/* --------------------------------- Query keys -------------------------------- */

export const dietKeys = {
  plans: ["diet", "plans"] as const,
  meals: (date: string) => ["diet", "meals", date] as const,
  /** Pasti in un intervallo (usato dal grafico calorie dei Progressi). */
  mealsRange: (from: string, to: string) => ["diet", "meals", "range", from, to] as const,
  foodItems: (mealId: string) => ["diet", "food-items", mealId] as const,
  /** Prefisso per invalidare TUTTE le query degli alimenti. */
  foodItemsAll: ["diet", "food-items"] as const,
};

/** Gli errori HTTP 4xx sono risposte, non intoppi: mai in retry. */
function noRetry(failureCount: number, error: unknown): boolean {
  return isApiError(error) ? error.status >= 500 && failureCount < 1 : failureCount < 2;
}

/* --------------------------------- Queries ---------------------------------- */

/** Lista piani dieta (created_at desc). Il piano attivo ha `is_active`. */
export function useDietPlans() {
  return useQuery({
    queryKey: dietKeys.plans,
    queryFn: () => api.get<ApiDietPlan[]>("/diet-plans"),
    retry: noRetry,
  });
}

/** Pasti di una data (`YYYY-MM-DD`): il filtro `date` è obbligatorio. */
export function useMealsForDate(date: string) {
  return useQuery({
    queryKey: dietKeys.meals(date),
    queryFn: () => api.get<ApiMeal[]>(`/meals?date=${date}`),
    retry: noRetry,
  });
}

/** Pasti in un intervallo di date (`from`/`to` compresi, `YYYY-MM-DD`). */
export function useMealsInRange(from: string, to: string) {
  return useQuery({
    queryKey: dietKeys.mealsRange(from, to),
    queryFn: () => api.get<ApiMeal[]>(`/meals?from=${from}&to=${to}`),
    retry: noRetry,
  });
}

/**
 * Alimenti dei pasti elencati: una query per pasto (l'API accetta solo
 * `meal_id`). L'elenco cambia a runtime → `useQueries`, risultati
 * allineati per indice con i pasti.
 */
export function useFoodQueries(meals: ApiMeal[] | undefined) {
  return useQueries({
    queries: (meals ?? []).map((meal) => ({
      queryKey: dietKeys.foodItems(meal.id),
      queryFn: () => api.get<ApiFoodItem[]>(`/food-items?meal_id=${meal.id}`),
      retry: noRetry,
    })),
  });
}

/* -------------------------------- Mappature -------------------------------- */

function toFoodItem(item: ApiFoodItem): FoodItem {
  return {
    id: item.id,
    mealId: item.meal_id,
    name: item.name,
    quantityG: item.quantity_g ?? 0,
    calories: item.calories,
    proteinG: item.protein_g,
    carbsG: item.carbs_g,
    fatsG: item.fat_g,
    source: item.source,
    barcode: item.barcode ?? "",
  };
}

export type DiaryTotals = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatsG: number;
};

/**
 * Diario di una data: i 4 pasti nell'ordine UI (Colazione…Snack) con gli
 * alimenti compilati — per i pasti non ancora creati torna un gruppo vuoto
 * che fa da bersaglio al primo inserimento.
 */
export type DiaryDay = {
  meals: Meal[];
  totals: DiaryTotals;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
};

export function useDiaryDay(date: string): DiaryDay {
  const mealsQuery = useMealsForDate(date);
  const foodResults = useFoodQueries(mealsQuery.data);

  const apiMeals = mealsQuery.data ?? [];
  const itemsByMeal = new Map<string, FoodItem[]>();
  apiMeals.forEach((meal, index) => {
    itemsByMeal.set(meal.id, (foodResults[index]?.data ?? []).map(toFoodItem));
  });

  const meals: Meal[] = MEAL_TYPES.map((label) => {
    const apiMeal = apiMeals.find((m) => API_MEAL_TYPE_TO_LABEL[m.meal_type] === label);
    const foodItems = apiMeal ? (itemsByMeal.get(apiMeal.id) ?? []) : [];
    return {
      // Gruppo non ancora persistito: id deterministico per la chiave React.
      id: apiMeal?.id ?? `${date}-${label}`,
      dietPlanId: apiMeal?.diet_plan_id ?? "",
      userId: apiMeal?.user_id ?? "",
      type: label,
      date,
      totalCalories: foodItems.reduce((sum, item) => sum + item.calories, 0),
      foodItems,
    };
  });

  const totals: DiaryTotals = meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.totalCalories,
      proteinG: acc.proteinG + meal.foodItems.reduce((s, f) => s + f.proteinG, 0),
      carbsG: acc.carbsG + meal.foodItems.reduce((s, f) => s + f.carbsG, 0),
      fatsG: acc.fatsG + meal.foodItems.reduce((s, f) => s + f.fatsG, 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatsG: 0 },
  );

  const firstError =
    mealsQuery.error ?? foodResults.find((result) => result.error)?.error ?? null;

  return {
    meals,
    totals,
    isLoading:
      mealsQuery.isLoading || foodResults.some((result) => result.isLoading),
    isError: mealsQuery.isError || foodResults.some((result) => result.isError),
    error: firstError,
    refetch: () => {
      void mealsQuery.refetch();
      foodResults.forEach((result) => void result.refetch());
    },
  };
}

/* -------------------------------- Mutations -------------------------------- */

export type AddFoodsInput = {
  date: string;
  mealType: MealType;
  /** Uno o più alimenti da aggiungere allo stesso pasto. */
  drafts: DietFoodDraft[];
  /** Provenienza scritta su `food_items.source` (default `"manual"`). */
  source?: "barcode" | "photo" | "manual" | "upload" | "ai";
};

/**
 * Inserimento reale nel diario: assicura che il pasto esista per la data
 * (`POST /meals` solo la prima volta) e ci appende gli alimenti
 * (`POST /food-items`, uno per draft). In serie e non in parallelo: i
 * draft di una foto pasto devono finire tutti nello stesso pasto, senza
 * che due richieste creino due pasti duplicati.
 */
export function useAddFoodItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, mealType, drafts, source }: AddFoodsInput) => {
      const meals = await api.get<ApiMeal[]>(`/meals?date=${date}`);
      const existing = meals.find(
        (meal) => meal.meal_type === MEAL_TYPE_TO_API[mealType],
      );
      const meal =
        existing ??
        (await api.post<ApiMeal>("/meals", {
          meal_type: MEAL_TYPE_TO_API[mealType],
          date,
        }));
      const created: ApiFoodItem[] = [];
      for (const draft of drafts) {
        created.push(
          await api.post<ApiFoodItem>("/food-items", {
            meal_id: meal.id,
            name: draft.name,
            quantity_g: draft.quantityG,
            calories: Math.round(draft.calories),
            protein_g: Math.round(draft.proteinG * 10) / 10,
            carbs_g: Math.round(draft.carbsG * 10) / 10,
            fat_g: Math.round(draft.fatsG * 10) / 10,
            source: source ?? "manual",
          }),
        );
      }
      return created;
    },
    onSuccess: (_items, { date }) => {
      // Il pasto può essere appena nato: ricarica lista e tutti gli alimenti.
      void queryClient.invalidateQueries({ queryKey: dietKeys.meals(date) });
      void queryClient.invalidateQueries({ queryKey: dietKeys.foodItemsAll });
    },
  });
}

export type UpdateFoodInput = {
  foodId: string;
  mealId: string;
  patch: {
    quantityG: number;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatsG: number;
  };
};

/** Modifica di un alimento (la quantità riscala calorie e macro). */
export function useUpdateFoodItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ foodId, patch }: UpdateFoodInput) =>
      api.put<ApiFoodItem>(`/food-items/${foodId}`, {
        quantity_g: patch.quantityG,
        calories: Math.round(patch.calories),
        protein_g: Math.round(patch.proteinG * 10) / 10,
        carbs_g: Math.round(patch.carbsG * 10) / 10,
        fat_g: Math.round(patch.fatsG * 10) / 10,
      }),
    onSuccess: (_item, { mealId }) => {
      void queryClient.invalidateQueries({ queryKey: dietKeys.foodItems(mealId) });
      void queryClient.invalidateQueries({ queryKey: dietKeys.foodItemsAll });
    },
  });
}

/** Eliminazione di un alimento (204, nessun body). */
export function useDeleteFoodItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ foodId }: { foodId: string; mealId: string }) =>
      api.delete(`/food-items/${foodId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dietKeys.foodItemsAll });
    },
  });
}
