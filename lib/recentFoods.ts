import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DietFoodDraft } from "@/types";

const RECENT_FOODS_KEY = "fittrack_recent_foods";
const MAX_RECENT = 8;

export async function getRecentFoods(): Promise<DietFoodDraft[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_FOODS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DietFoodDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addRecentFood(food: DietFoodDraft): Promise<void> {
  try {
    const existing = await getRecentFoods();
    const filtered = existing.filter((f) => f.name.toLowerCase() !== food.name.toLowerCase());
    const next = [{ ...food }, ...filtered].slice(0, MAX_RECENT);
    await AsyncStorage.setItem(RECENT_FOODS_KEY, JSON.stringify(next));
  } catch {}
}

export async function clearRecentFoods(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RECENT_FOODS_KEY);
  } catch {}
}
