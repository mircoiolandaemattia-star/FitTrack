import { Text, View } from "react-native";

type MacroProgressBarProps = {
  label: string;
  current: number;
  target: number;
  color: string;
  unit?: string;
};

export function MacroProgressBar({ label, current, target, color, unit = "g" }: MacroProgressBarProps) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <Text className="font-inter-semibold text-xs text-muted">{label}</Text>
        <Text className="font-sans text-xs text-muted">
          <Text className="font-inter-semibold text-foreground">{Math.round(current)}{unit}</Text>
          <Text className="text-muted"> / {target}{unit}</Text>
        </Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-background">
        <View className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}
