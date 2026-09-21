import { Text, View } from "react-native";

type Props = {
  current: number; // 1-based
  total: number;
};

export function OnboardingProgressBar({ current, total }: Props) {
  const pct = Math.round((current / total) * 100);
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="font-sans text-xs text-muted">
          Passo {current} di {total}
        </Text>
        <Text className="font-inter-semibold text-xs text-primary">{pct}%</Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-surface">
        <View className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </View>
    </View>
  );
}
