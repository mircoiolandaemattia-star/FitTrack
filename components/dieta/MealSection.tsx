import { Platform, Pressable, Text, View } from "react-native";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react-native";
import type { Meal } from "@/types";
import { Card } from "@/components/home/Card";

type MealSectionProps = {
  meal: Meal;
  expanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onEditFood: (foodId: string) => void;
  onDeleteFood: (foodId: string) => void;
  readOnly: boolean;
};

export function MealSection({ meal, expanded, onToggle, onAdd, onEditFood, onDeleteFood, readOnly }: MealSectionProps) {
  const totalKcal = meal.foodItems.reduce((s, f) => s + f.calories, 0);
  const count = meal.foodItems.length;

  return (
    <Card className="overflow-hidden p-0">
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${meal.type}, ${totalKcal} kcal, ${count} alimenti`}
        className="cursor-pointer p-4 active:opacity-80"
      >
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
            <UtensilsCrossed size={18} color="#F97316" strokeWidth={2.2} />
          </View>
          <View className="flex-1">
            <Text className="font-inter-semibold text-base text-foreground">{meal.type}</Text>
            {!expanded ? (
              <Text className="mt-0.5 font-sans text-xs text-muted">
                {totalKcal} kcal · {count} {count === 1 ? "alimento" : "alimenti"}
              </Text>
            ) : (
              <Text className="mt-0.5 font-sans text-xs text-muted">
                {totalKcal} kcal totali
              </Text>
            )}
          </View>
          {!readOnly ? (
            <Pressable
              onPress={(e) => {
                // Evita di far scattare anche onToggle
                (e as unknown as { stopPropagation?: () => void })?.stopPropagation?.();
                onAdd();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Aggiungi alimento a ${meal.type}`}
              className="h-9 w-9 items-center justify-center rounded-full bg-primary active:opacity-80"
              hitSlop={6}
            >
              <Plus size={16} color="#0F172A" strokeWidth={2.5} />
            </Pressable>
          ) : null}
          <View className="ml-1">
            {expanded ? <ChevronUp size={18} color="#94A3B8" strokeWidth={2.2} /> : <ChevronDown size={18} color="#94A3B8" strokeWidth={2.2} />}
          </View>
        </View>
      </Pressable>

      {expanded ? (
        <View className="border-t border-border px-4 pb-4 pt-2">
          {meal.foodItems.length === 0 ? (
            <Text className="py-3 text-center font-sans text-sm text-muted">Nessun alimento aggiunto</Text>
          ) : (
            <View className="gap-2">
              {meal.foodItems.map((item) => (
                <View key={item.id} className="flex-row items-center gap-3 rounded-xl border border-border bg-background/40 px-3 py-3">
                  <View className="flex-1">
                    <Text className="font-inter-semibold text-sm text-foreground" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text className="mt-0.5 font-sans text-xs text-muted">
                      {item.quantityG}g · {item.calories} kcal
                    </Text>
                    <Text className="mt-0.5 font-sans text-xs text-muted/70">
                      P {item.proteinG}g · C {item.carbsG}g · G {item.fatsG}g
                    </Text>
                  </View>
                  {!readOnly ? (
                    <View className="flex-row items-center gap-1">
                      <Pressable
                        onPress={() => onEditFood(item.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Modifica ${item.name}`}
                        className="h-9 w-9 items-center justify-center rounded-lg bg-surface active:opacity-60"
                      >
                        <Pencil size={16} color="#94A3B8" strokeWidth={2.2} />
                      </Pressable>
                      <Pressable
                        onPress={() => onDeleteFood(item.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Elimina ${item.name}`}
                        className="h-9 w-9 items-center justify-center rounded-lg bg-destructive/15 active:opacity-60"
                      >
                        <Trash2 size={16} color="#EF4444" strokeWidth={2.2} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          )}
          {!readOnly ? (
            <Pressable
              onPress={onAdd}
              accessibilityRole="button"
              className="mt-3 flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-background/20 py-3 active:opacity-80"
            >
              <Plus size={16} color="#94A3B8" strokeWidth={2.2} />
              <Text className="font-inter-semibold text-sm text-muted">Aggiungi alimento</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}
