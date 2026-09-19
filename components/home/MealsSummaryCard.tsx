import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Plus, UtensilsCrossed } from "lucide-react-native";
import type { Meal } from "@/types";
import { Card } from "./Card";

type MealsSummaryCardProps = {
  meals: Meal[];
};

/**
 * Card "Pasti di oggi": elenco pasti con calorie e bottone "+"
 * per aggiungerne uno nuovo (naviga alla tab Dieta).
 */
export function MealsSummaryCard({ meals }: MealsSummaryCardProps) {
  function handleAddMeal() {
    router.navigate("/(tabs)/dieta");
  }

  return (
    <Card>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-accent/15">
            <UtensilsCrossed size={22} color="#22C55E" strokeWidth={2.2} />
          </View>
          <Text className="font-inter-semibold text-base text-foreground">Pasti di oggi</Text>
        </View>

        <Pressable
          onPress={handleAddMeal}
          accessibilityRole="button"
          accessibilityLabel="Aggiungi un pasto"
          hitSlop={8}
          className="h-11 w-11 items-center justify-center rounded-xl bg-primary/15 active:opacity-80 cursor-pointer"
        >
          <Plus size={22} color="#F97316" strokeWidth={2.5} />
        </Pressable>
      </View>

      {meals.length === 0 ? (
        <View className="mt-4 rounded-xl border border-dashed border-border px-4 py-6">
          <Text className="text-center font-sans text-sm text-muted">
            Nessun pasto registrato
          </Text>
        </View>
      ) : (
        <View className="mt-4 gap-2">
          {meals.map((meal) => (
            <View
              key={meal.id}
              className="flex-row items-center justify-between rounded-xl bg-background/60 px-4 py-3"
            >
              <View className="flex-row items-center gap-2.5">
                <View className="h-2 w-2 rounded-full bg-primary" />
                <Text className="font-sans text-sm text-foreground">{meal.type}</Text>
              </View>
              <Text className="font-inter-semibold text-sm text-foreground">
                {meal.totalCalories} kcal
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}