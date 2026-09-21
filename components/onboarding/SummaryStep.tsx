import { Text, View } from "react-native";
import { Flame, Drum, Wheat, Droplets } from "lucide-react-native";
import { calculateTDEE, type ActivityLevel, type Gender, type Goal } from "@/lib/calorieCalculator";

type Props = {
  weight: number;
  height: number;
  age: number;
  gender: Gender | string;
  activity: ActivityLevel | string;
  goal: Goal | string;
};

export function SummaryStep({ weight, height, age, gender, activity, goal }: Props) {
  const tdee = calculateTDEE(weight, height, age, gender, activity, goal) ?? 0;
  const proteinG = Math.round((tdee * 0.3) / 4);
  const carbsG = Math.round((tdee * 0.45) / 4);
  const fatsG = Math.round((tdee * 0.25) / 9);

  return (
    <View className="gap-6">
      <View className="items-center gap-2">
        <View className="h-16 w-16 items-center justify-center rounded-3xl bg-primary/15">
          <Flame size={28} color="#F97316" />
        </View>
        <Text className="font-sans text-sm text-muted">Il tuo fabbisogno stimato</Text>
        <Text className="font-inter-bold text-4xl text-primary">{tdee} kcal / giorno</Text>
        <Text className="text-center font-sans text-xs text-muted">Harris-Benedict + TDEE. Valore indicativo.</Text>
      </View>

      <View className="rounded-2xl border border-border bg-surface p-4">
        <Text className="font-inter-semibold text-sm text-foreground">Suddivisione macro consigliata</Text>
        <View className="mt-4 gap-3">
          <View className="flex-row items-center gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
              <Drum size={16} color="#F97316" />
            </View>
            <View className="flex-1">
              <Text className="font-sans text-xs text-muted">Proteine 30%</Text>
              <Text className="font-inter-semibold text-sm text-foreground">{proteinG} g</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-accent/15">
              <Wheat size={16} color="#22C55E" />
            </View>
            <View className="flex-1">
              <Text className="font-sans text-xs text-muted">Carboidrati 45%</Text>
              <Text className="font-inter-semibold text-sm text-foreground">{carbsG} g</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15">
              <Droplets size={16} color="#F59E0B" />
            </View>
            <View className="flex-1">
              <Text className="font-sans text-xs text-muted">Grassi 25%</Text>
              <Text className="font-inter-semibold text-sm text-foreground">{fatsG} g</Text>
            </View>
          </View>
        </View>
      </View>

      <Text className="text-center font-sans text-xs leading-4 text-muted">Potrai modificare questi valori in qualsiasi momento dal profilo.</Text>
    </View>
  );
}
