import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import type { CaloriePoint } from "@/lib/progressMock";

type Props = {
  average: number;
  target: number;
  days: CaloriePoint[];
};

export function CalorieChart({ average, target, days }: Props) {
  const [containerW, setContainerW] = useState(0);
  const h = 160;
  const padL = 28;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  // Usa larghezza misurata; fallback 320 per primo render
  const measuredW = containerW > 0 ? containerW : 320;
  // Per 30gg le barre diventano troppo strette: garantisci min 10px per barra + gap
  const minNeeded = days.length * 10 + (days.length - 1) * 4 + padL + padR;
  const needsScroll = minNeeded > measuredW;
  const w = needsScroll ? minNeeded : measuredW;

  if (days.length === 0) {
    return (
      <View className="items-center py-6">
        <Text className="font-sans text-sm text-muted">Nessun dato calorie</Text>
      </View>
    );
  }

  const maxCal = Math.max(target * 1.2, ...days.map((d) => d.calories));
  const minCal = 0;
  const range = maxCal - minCal || 1;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const barGap = 4;
  const barW = Math.max(6, (plotW - barGap * (days.length - 1)) / days.length);
  const targetY = padT + (1 - (target - minCal) / range) * plotH;

  return (
    <View className="gap-3">
      <Text className="font-inter-semibold text-sm text-foreground">Media: {average} kcal</Text>
      <View
        className="w-full overflow-hidden"
        onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
        style={{ height: h, width: "100%" }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={{ width: w, height: h }}
          style={{ width: "100%", height: h }}
          scrollEnabled={needsScroll}
        >
          <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          {/* grid */}
          {[0, 1, 2, 3].map((i) => {
            const gy = padT + (i / 3) * plotH;
            return <Line key={i} x1={padL} y1={gy} x2={padL + plotW} y2={gy} stroke="#334155" strokeOpacity={0.35} strokeWidth={1} strokeDasharray="4 4" />;
          })}
          {/* target line */}
          <Line x1={padL} y1={targetY} x2={padL + plotW} y2={targetY} stroke="#F97316" strokeWidth={1.5} strokeDasharray="6 4" />
          <SvgText x={padL + plotW} y={targetY - 4} fill="#F97316" fontSize={9} textAnchor="end">
            {target}
          </SvgText>

          {/* bars */}
          {days.map((d, i) => {
            const barH = ((d.calories - minCal) / range) * plotH;
            const x = padL + i * (barW + barGap);
            const y = padT + plotH - barH;
            const over = d.calories > target;
            return <Rect key={d.date} x={x} y={y} width={barW} height={barH} rx={3} fill={over ? "#EF4444" : "#22C55E"} />;
          })}

          {/* X labels subset */}
          {days.map((d, i) => {
            if (days.length > 14 && i % Math.ceil(days.length / 7) !== 0 && i !== days.length - 1) return null;
            if (days.length <= 14 && days.length > 7 && i % 2 !== 0 && i !== days.length - 1) return null;
            const x = padL + i * (barW + barGap) + barW / 2;
            return (
              <SvgText key={`lbl-${d.date}`} x={x} y={h - 6} fill="#94A3B8" fontSize={9} textAnchor="middle">
                {d.label}
              </SvgText>
            );
          })}
          </Svg>
          </ScrollView>
        </View>

      {/* Legenda */}
      <View className="flex-row items-center gap-4">
        <View className="flex-row items-center gap-1.5">
          <View className="h-2.5 w-2.5 rounded-sm bg-accent" style={{ backgroundColor: "#22C55E" }} />
          <Text className="font-sans text-xs text-muted">Sotto soglia</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="h-2.5 w-2.5 rounded-sm bg-destructive" />
          <Text className="font-sans text-xs text-muted">Sopra soglia</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="h-0.5 w-4 bg-primary" />
          <Text className="font-sans text-xs text-muted">Obiettivo {target}</Text>
        </View>
      </View>
    </View>
  );
}
