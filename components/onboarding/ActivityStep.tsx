import { Pressable, Text, View } from "react-native";
import { ACTIVITY_OPTIONS, type ActivityLevel } from "@/lib/calorieCalculator";

type Props = {
  value: ActivityLevel | "";
  onChange: (v: ActivityLevel) => void;
};

export function ActivityStep({ value, onChange }: Props) {
  return (
    <View className="gap-5">
      <Text className="font-inter-bold text-2xl text-foreground">Quanto ti muovi?</Text>
      <Text className="font-sans text-sm text-muted">Serve per stimare il dispendio giornaliero (TDEE).</Text>

      <View className="gap-3">
        {ACTIVITY_OPTIONS.map((o) => {
          const active = value === o.key;
          return (
            <Pressable
              key={o.key}
              onPress={() => onChange(o.key)}
              className={`rounded-2xl border p-4 active:opacity-80 ${active ? "border-primary bg-primary/10" : "border-border bg-surface"}`}
            >
              <View className="flex-row items-center justify-between">
                <Text className={`font-inter-semibold text-base ${active ? "text-primary" : "text-foreground"}`}>{o.label}</Text>
                <View className={`h-5 w-5 rounded-full border-2 items-center justify-center ${active ? "border-primary bg-primary" : "border-border"}`}>
                  {active ? <View className="h-2 w-2 rounded-full bg-white" /> : null}
                </View>
              </View>
              <Text className="mt-1 font-sans text-sm leading-5 text-muted">{o.description}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
