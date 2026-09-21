import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/home/Card";
import { calculateTDEE, GOAL_OPTIONS, type ActivityLevel, type Goal } from "@/lib/calorieCalculator";

type Props = {
  value: Goal | string | null;
  weightKg?: number | null;
  heightCm?: number | null;
  age?: number | null;
  gender?: string | null;
  activityLevel?: ActivityLevel | string | null;
  readOnly?: boolean;
  onChange: (g: Goal) => void;
};

export function GoalSelector({ value, weightKg, heightCm, age, gender, activityLevel, readOnly = false, onChange }: Props) {
  const selected = GOAL_OPTIONS.find((o) => o.key === value);
  const tdee = calculateTDEE(weightKg ?? 0, heightCm ?? 0, age ?? 0, gender ?? null, activityLevel ?? null, value as Goal);

  return (
    <Card className="gap-4">
      <Text className="font-inter-semibold text-base text-foreground">Obiettivo</Text>

      <View className="gap-2">
        {GOAL_OPTIONS.map((o) => {
          const active = value === o.key;
          return (
            <Pressable
              key={o.key}
              disabled={readOnly}
              onPress={() => onChange(o.key)}
              className={`rounded-xl border px-4 py-3.5 active:opacity-80 ${active ? "border-primary bg-primary/15" : "border-border bg-background/40"} ${readOnly ? "opacity-60" : ""}`}
            >
              <View className="flex-row items-center justify-between gap-2">
                <View className="flex-1 gap-0.5">
                  <Text className={`font-inter-semibold text-sm ${active ? "text-primary" : "text-foreground"}`}>{o.label}</Text>
                  <Text className="font-sans text-xs leading-4 text-muted">{o.description}</Text>
                </View>
                <View className={`h-6 w-6 items-center justify-center rounded-full border-2 ${active ? "border-primary bg-primary" : "border-border"}`}>
                  {active ? <View className="h-2.5 w-2.5 rounded-full bg-white" /> : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      {tdee ? (
        <View className="rounded-xl bg-primary/10 px-4 py-3">
          <Text className="font-sans text-xs text-muted">Fabbisogno ricalcolato</Text>
          <Text className="font-inter-bold text-lg text-primary">{tdee} kcal / giorno</Text>
        </View>
      ) : (
        <Text className="font-sans text-xs text-muted">Completa peso, altezza ed età per vedere il fabbisogno.</Text>
      )}
    </Card>
  );
}
