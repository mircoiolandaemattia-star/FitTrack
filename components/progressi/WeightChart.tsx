import { Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import type { WeightPoint } from "@/lib/progressMock";

type Props = {
  points: WeightPoint[];
  current: number;
  delta: number;
  goalOk: boolean;
};

export function WeightChart({ points, current, delta, goalOk }: Props) {
  const { width } = useWindowDimensions();
  // chart width responsive: container padding 16*2 + card padding 20*2
  const chartH = 160;
  const padL = 28;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  // we render inside parent with flex; use 100% via onLayout? simpler fixed based on window
  const cardInnerW = Math.min(width - 32 - 40, 560); // approx
  const w = cardInnerW;
  const h = chartH;

  if (points.length === 0) {
    return (
      <View className="items-center py-6">
        <Text className="font-sans text-sm text-muted">Nessun dato peso</Text>
      </View>
    );
  }

  const weights = points.map((p) => p.weight);
  const min = Math.min(...weights) - 0.5;
  const max = Math.max(...weights) + 0.5;
  const range = max - min || 1;

  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const x = (i: number) => padL + (i / Math.max(1, points.length - 1)) * plotW;
  const y = (v: number) => padT + (1 - (v - min) / range) * plotH;

  let d = "";
  points.forEach((p, i) => {
    const xi = x(i);
    const yi = y(p.weight);
    d += i === 0 ? `M ${xi} ${yi}` : ` L ${xi} ${yi}`;
  });

  // grid + labels
  const deltaLabel = `${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg`;
  const deltaColor = goalOk ? "#22C55E" : "#EF4444";

  return (
    <View className="gap-3">
      <View className="flex-row items-baseline gap-2">
        <Text className="font-inter-bold text-3xl text-foreground">{current.toFixed(1)} kg</Text>
        <Text style={{ color: deltaColor }} className="font-inter-semibold text-sm">
          {deltaLabel}
        </Text>
        <Text className="font-sans text-xs text-muted">vs inizio periodo</Text>
      </View>

      <View style={{ height: h, width: w, alignSelf: "center" }}>
        <Svg width={w} height={h}>
          {/* horizontal grid */}
          {[0, 1, 2, 3].map((i) => {
            const gy = padT + (i / 3) * plotH;
            return <Line key={i} x1={padL} y1={gy} x2={padL + plotW} y2={gy} stroke="#334155" strokeOpacity={0.4} strokeWidth={1} strokeDasharray="4 4" />;
          })}
          {/* line */}
          <Path d={d} stroke="#F97316" strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {/* points */}
          {points.map((p, i) => (
            <Circle key={p.date} cx={x(i)} cy={y(p.weight)} r={3.5} fill="#F97316" stroke="#0F172A" strokeWidth={1.5} />
          ))}
          {/* X labels: show subset to avoid crowding */}
          {points.map((p, i) => {
            const step = points.length > 12 ? Math.ceil(points.length / 6) : 1;
            if (i % step !== 0 && i !== points.length - 1) return null;
            return (
              <SvgText key={`lbl-${p.date}`} x={x(i)} y={h - 6} fill="#94A3B8" fontSize={10} textAnchor="middle">
                {p.label}
              </SvgText>
            );
          })}
        </Svg>
      </View>
    </View>
  );
}
