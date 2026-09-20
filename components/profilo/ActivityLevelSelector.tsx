import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/home/Card";
import { ACTIVITY_OPTIONS, calculateTDEE, type ActivityLevel, type Goal } from "@/lib/calorieCalculator";

type Props = {
  value: ActivityLevel | string | null;
  goal?: Goal | string | null;
  weightKg?: number | null;
  heightCm?: number | null;
  age?: number | null;
  gender?: string | null;
  readOnly?: boolean;
  onChange: (v: ActivityLevel) => void;
};

export function ActivityLevelSelector({ value, goal, weightKg, heightCm, age, gender, readOnly = false, onChange }: Props) {
  const tdee = calculateTDEE(weightKg ?? 0, heightCm ?? 0, age ?? 0, gender ?? null, value as ActivityLevel, goal as Goal);
  return (
    <Card className="gap-4">
      <Text className="font-inter-semibold text-base text-foreground">Livello di attività</Text>

      <View className="gap-2">
        {ACTIVITY_OPTIONS.map((o) => {
          const active = value === o.key;
          return (
            <Pressable
              key={o.key}
              disabled={readOnly}
              onPress={() => onChange(o.key)}
              className={`rounded-xl border px-4 py-3 active:opacity-80 ${active ? "border-primary bg-primary/15" : "border-border bg-background/40"} ${readOnly ? "opacity-60" : ""}`}
            >
              <Text className={`font-inter-semibold text-sm ${active ? "text-primary" : "text-foreground"}`}>{o.label}</Text>
              <Text className="mt-1 font-sans text-xs leading-4 text-muted">{o.description}</Text>
            </Pressable>
          );
        })}
      </View>

      {tdee ? (
        <View className="rounded-xl bg-primary/10 px-4 py-3">
          <Text className="font-sans text-xs text-muted">Fabbisogno ricalcolato</Text>
          <Text className="font-inter-bold text-lg text-primary">{tdee} kcal / giorno</Text>
        </View>
      ) : null}
    </Card>
  );
}
