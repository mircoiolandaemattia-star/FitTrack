import { Pressable, Text, View } from "react-native";
import { TrendingDown, Minus, TrendingUp } from "lucide-react-native";
import { GOAL_OPTIONS, type Goal } from "@/lib/calorieCalculator";

const ICONS: Record<Goal, React.ReactNode> = {
  dimagrire: <TrendingDown size={22} color="#F97316" />,
  mantenimento: <Minus size={22} color="#22C55E" />,
  massa: <TrendingUp size={22} color="#38BDF8" />,
};

type Props = {
  value: Goal | "";
  onChange: (g: Goal) => void;
};

export function GoalStep({ value, onChange }: Props) {
  return (
    <View className="gap-5">
      <Text className="font-inter-bold text-2xl text-foreground">Il tuo obiettivo</Text>
      <Text className="font-sans text-sm text-muted">Scegli cosa vuoi ottenere. Potrai cambiarlo più tardi dal profilo.</Text>

      <View className="gap-3">
        {GOAL_OPTIONS.map((o) => {
          const active = value === o.key;
          return (
            <Pressable
              key={o.key}
              onPress={() => onChange(o.key)}
              className={`flex-row items-center gap-4 rounded-2xl border p-4 active:opacity-80 ${active ? "border-primary bg-primary/10" : "border-border bg-surface"}`}
            >
              <View className={`h-11 w-11 items-center justify-center rounded-xl ${active ? "bg-primary/15" : "bg-background"}`}>{ICONS[o.key]}</View>
              <View className="flex-1 gap-1">
                <Text className={`font-inter-semibold text-base ${active ? "text-primary" : "text-foreground"}`}>{o.label}</Text>
                <Text className="font-sans text-sm leading-5 text-muted">{o.description}</Text>
              </View>
              <View className={`h-5 w-5 rounded-full border-2 items-center justify-center ${active ? "border-primary bg-primary" : "border-border"}`}>
                {active ? <View className="h-2 w-2 rounded-full bg-white" /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
