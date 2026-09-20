import { Pressable, Text, View } from "react-native";
import type { Period } from "@/lib/progressMock";
import { PERIOD_LABELS } from "@/lib/progressMock";

type Props = {
  value: Period;
  onChange: (p: Period) => void;
};

const OPTIONS: Period[] = ["week", "month", "3months"];

export function PeriodSelector({ value, onChange }: Props) {
  return (
    <View className="flex-row gap-2 rounded-full bg-surface p-1">
      {OPTIONS.map((p) => {
        const active = value === p;
        return (
          <Pressable
            key={p}
            onPress={() => onChange(p)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={`flex-1 items-center rounded-full px-3 py-2.5 active:opacity-80 ${active ? "bg-primary" : "bg-transparent"}`}
          >
            <Text className={`font-inter-semibold text-sm ${active ? "text-primary-foreground" : "text-muted"}`}>
              {PERIOD_LABELS[p]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
