import type { DietDraft, DietFoodDraft, FoodItem, Meal } from "@/types";
import { getTodayMeals, MOCK_CALORIE_TARGET } from "./mock-data";

/** Target giornalieri — coerenti con Mock. */
export const DIET_TARGETS = {
  calories: MOCK_CALORIE_TARGET, // 2200
  proteinG: 180,
  carbsG: 250,
  fatsG: 75,
} as const;

/** Tipi pasto supportati. */
export const MEAL_TYPES = ["Colazione", "Pranzo", "Cena", "Snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

/** Mock: quante foto l'utente ha usato oggi (per testare il banner limite). */
export let MOCK_FOTO_USATE_OGGI = 1;
export const MOCK_FOTO_LIMITE_GIORNALIERO = 2;

export function setMockFotoUsateOggi(v: number) {
  MOCK_FOTO_USATE_OGGI = v;
}
export function incrementMockFotoUsateOggi() {
  MOCK_FOTO_USATE_OGGI += 1;
}

/* ------------------------------------------------------------------ */
/* Store in-memory dei pasti per data (YYYY-MM-DD → Meal[])             */
/* ------------------------------------------------------------------ */

const mealsByDate = new Map<string, Meal[]>();

function ensureDate(dateStr: string): Meal[] {
  if (!mealsByDate.has(dateStr)) {
    // Inizializza con i pasti di oggi solo per la data odierna; altrimenti vuoti
    const todayStr = new Date().toISOString().slice(0, 10);
    if (dateStr === todayStr) {
      mealsByDate.set(dateStr, cloneMeals(getTodayMeals()));
    } else {
      mealsByDate.set(
        dateStr,
        MEAL_TYPES.map((type) => ({
          id: `meal-${type.toLowerCase()}-${dateStr}`,
          dietPlanId: "diet-mock-1",
          userId: "mock-user-1",
          type,
          date: dateStr,
          totalCalories: 0,
          foodItems: [],
        })),
      );
    }
  }
  return mealsByDate.get(dateStr)!;
}

function cloneMeals(meals: Meal[]): Meal[] {
  return meals.map((m) => ({
    ...m,
    foodItems: m.foodItems.map((f) => ({ ...f })),
  }));
}

export function getMealsForDate(dateStr: string): Meal[] {
  return ensureDate(dateStr).map((m) => ({ ...m, foodItems: [...m.foodItems] }));
}

export type DietTotals = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatsG: number;
};

export function getDietTotals(dateStr: string): DietTotals {
  const meals = ensureDate(dateStr);
  let calories = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatsG = 0;
  for (const meal of meals) {
    for (const item of meal.foodItems) {
      calories += item.calories;
      proteinG += item.proteinG;
      carbsG += item.carbsG;
      fatsG += item.fatsG;
    }
  }
  return { calories, proteinG, carbsG, fatsG };
}

function toFoodItem(mealId: string, draft: DietFoodDraft): FoodItem {
  return {
    id: draft.id || `fi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    mealId,
    name: draft.name,
    quantityG: draft.quantityG,
    calories: Math.round(draft.calories),
    proteinG: Math.round(draft.proteinG * 10) / 10,
    carbsG: Math.round(draft.carbsG * 10) / 10,
    fatsG: Math.round(draft.fatsG * 10) / 10,
    source: "manual",
    barcode: "",
  };
}

export function addFoodToMeal(dateStr: string, mealType: MealType, draft: DietFoodDraft): FoodItem {
  const meals = ensureDate(dateStr);
  const meal = meals.find((m) => m.type === mealType);
  if (!meal) throw new Error(`Meal type ${mealType} not found for ${dateStr}`);
  const item = toFoodItem(meal.id, draft);
  meal.foodItems = [...meal.foodItems, item];
  meal.totalCalories = meal.foodItems.reduce((s, f) => s + f.calories, 0);
  return item;
}

export function removeFoodFromMeal(dateStr: string, mealType: MealType, foodId: string): void {
  const meals = ensureDate(dateStr);
  const meal = meals.find((m) => m.type === mealType);
  if (!meal) return;
  meal.foodItems = meal.foodItems.filter((f) => f.id !== foodId);
  meal.totalCalories = meal.foodItems.reduce((s, f) => s + f.calories, 0);
}

export function updateFoodInMeal(
  dateStr: string,
  mealType: MealType,
  foodId: string,
  patch: Partial<DietFoodDraft>,
): void {
  const meals = ensureDate(dateStr);
  const meal = meals.find((m) => m.type === mealType);
  if (!meal) return;
  meal.foodItems = meal.foodItems.map((f) =>
    f.id === foodId
      ? {
          ...f,
          name: patch.name ?? f.name,
          quantityG: patch.quantityG ?? f.quantityG,
          calories: patch.calories !== undefined ? Math.round(patch.calories) : f.calories,
          proteinG: patch.proteinG ?? f.proteinG,
          carbsG: patch.carbsG ?? f.carbsG,
          fatsG: patch.fatsG ?? f.fatsG,
        }
      : f,
  );
  meal.totalCalories = meal.foodItems.reduce((s, f) => s + f.calories, 0);
}

/* ------------------------------------------------------------------ */
/* Helpers per data                                                    */
/* ------------------------------------------------------------------ */

export function formatDayLabel(date: Date): string {
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  if (isToday) return "Oggi";
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(date);
}

export function dateToString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, offset: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + offset);
  return d;
}

/* ------------------------------------------------------------------ */
/* Mocks per "Genera dieta con AI"                                     */
/* ------------------------------------------------------------------ */

export function buildMockDietDraft(): DietDraft {
  const todayStr = dateToString(new Date());
  const mkFood = (id: string, name: string, qty: number, cal: number, p: number, c: number, f: number): DietFoodDraft => ({
    id, name, quantityG: qty, calories: cal, proteinG: p, carbsG: c, fatsG: f,
  });
  const days: DietDraft["days"] = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(new Date(), i);
    const dateStr = dateToString(d);
    return {
      id: `diet-day-${i}`,
      date: dateStr,
      meals: [
        { id: `draft-m-col-${i}`, type: "Colazione", foodItems: [mkFood(`df-${i}-1`, "Porridge d'avena con frutti di bosco", 250, 290, 11, 48, 5)] },
        { id: `draft-m-pra-${i}`, type: "Pranzo", foodItems: [mkFood(`df-${i}-2`, "Petto di pollo alla griglia + riso basmati", 300, 420, 42, 44, 8)] },
        { id: `draft-m-cena-${i}`, type: "Cena", foodItems: [mkFood(`df-${i}-3`, "Salmone al forno con verdure", 280, 380, 32, 12, 22)] },
        { id: `draft-m-snack-${i}`, type: "Snack", foodItems: [mkFood(`df-${i}-4`, "Yogurt greco + mandorle", 150, 180, 14, 10, 9)] },
      ],
    };
  });
  void todayStr;
  return { id: `diet-draft-${Date.now()}`, name: "Piano AI bilanciato — 2200 kcal", days };
}

export function applyDietDraft(draft: DietDraft): void {
  for (const day of draft.days) {
    const existing = ensureDate(day.date);
    for (const mealDraft of day.meals) {
      const target = existing.find((m) => m.type === mealDraft.type);
      if (!target) continue;
      // Sovrascrive gli alimenti del giorno con quelli del draft (demo).
      // In produzione: merge o replace a scelta.
      target.foodItems = mealDraft.foodItems.map((f) => toFoodItem(target.id, f));
      target.totalCalories = target.foodItems.reduce((s, f) => s + f.calories, 0);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Prodotto mock per barcode                                            */
/* ------------------------------------------------------------------ */

export type MockBarcodeProduct = {
  name: string;
  brand: string;
  barcode: string;
  per100g: { calories: number; proteinG: number; carbsG: number; fatsG: number };
};

export const MOCK_BARCODE_PRODUCT: MockBarcodeProduct = {
  name: "Yogurt greco 0% bianco",
  brand: "FitBrand",
  barcode: "8001234567890",
  per100g: { calories: 59, proteinG: 10, carbsG: 3.6, fatsG: 0.4 },
};

/* Mock foto AI: da descrizione → draft */
export function mockAnalyzePhoto(_description: string): DietFoodDraft {
  // Restituisce un risultato mock modificabile
  return {
    id: `ai-photo-${Date.now()}`,
    name: "Piatto analizzato dall'AI",
    quantityG: 350,
    calories: 520,
    proteinG: 38,
    carbsG: 42,
    fatsG: 18,
  };
}
