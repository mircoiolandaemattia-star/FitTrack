import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Card } from "./Card";

type CalorieRingProps = {
  consumed: number;
  target: number;
};

const SIZE = 176;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const COLORS = {
  track: "#334155",
  progress: "#F97316",
};

/**
 * Card calorie con ring di progresso circolare (SVG).
 * Mostra calorie consumate vs fabbisogno e la legenda
 * Consumate / Rimanenti con i valori (accessibile via testo).
 */
export function CalorieRing({ consumed, target }: CalorieRingProps) {
  const ratio = target > 0 ? Math.min(consumed / target, 1) : 0;
  const remaining = Math.max(target - consumed, 0);
  const progressLength = CIRCUMFERENCE * ratio;

  return (
    <Card>
      <Text className="font-inter-semibold text-base text-foreground">Calorie di oggi</Text>

      <View className="mt-4 items-center">
        <View
          style={{ height: SIZE, width: SIZE }}
          accessible
          accessibilityLabel={`Calorie consumate ${consumed} su un totale di ${target}`}
        >
          <Svg width={SIZE} height={SIZE}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={COLORS.track}
              strokeWidth={STROKE}
              fill="none"
            />
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={COLORS.progress}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${progressLength} ${CIRCUMFERENCE}`}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          </Svg>
          <View className="absolute inset-0 items-center justify-center">
            <Text className="font-inter-bold text-2xl text-foreground">{consumed}</Text>
            <Text className="font-sans text-xs text-muted">/ {target} kcal</Text>
          </View>
        </View>

        <View className="mt-3 w-full flex-row justify-between">
          <View className="flex-row items-center gap-2">
            <View className="h-2.5 w-2.5 rounded-full bg-primary" />
            <Text className="font-sans text-sm text-muted">Consumate</Text>
            <Text className="font-inter-semibold text-sm text-foreground">{consumed}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <View className="h-2.5 w-2.5 rounded-full bg-border" />
            <Text className="font-sans text-sm text-muted">Rimanenti</Text>
            <Text className="font-inter-semibold text-sm text-foreground">{remaining}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}