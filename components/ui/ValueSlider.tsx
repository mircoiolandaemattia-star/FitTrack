import { useCallback, useMemo, useState } from "react";
import { PanResponder, Text, View, type AccessibilityActionEvent, type LayoutChangeEvent } from "react-native";

type ValueSliderProps = {
  /** Etichetta della barra: è anche l'etichetta di accessibilità. */
  label: string;
  value: number;
  min: number;
  max: number;
  /** Arrotondamento del valore (default 1). */
  step?: number;
  /** Tacche mostrate sotto la barra. */
  ticks?: string[];
  /** Testo mostrato a destra; di default il numero grezzo. */
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
};

/** Larghezza del pulsante: la corsa utile parte da metà pulsante. */
const THUMB = 24;

/**
 * Barra valori trascinabile (stile slider del timer di sistema): un tap
 * qualsiasi sulla barra sposta subito il valore, senza bisogno di "agganciare"
 * prima il pulsante. Usata per ore e minuti del promemoria.
 */
export function ValueSlider({ label, value, min, max, step = 1, ticks, formatValue, onChange }: ValueSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);

  const usable = Math.max(1, trackWidth - THUMB);
  const ratio = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;

  const apply = useCallback(
    (locationX: number) => {
      if (trackWidth <= 0) return;
      const localRatio = Math.min(1, Math.max(0, (locationX - THUMB / 2) / usable));
      const raw = min + localRatio * (max - min);
      const stepped = Math.round(raw / step) * step;
      onChange(Math.min(max, Math.max(min, stepped)));
    },
    [trackWidth, usable, min, max, step, onChange],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => apply(event.nativeEvent.locationX),
        onPanResponderMove: (event) => apply(event.nativeEvent.locationX),
        onPanResponderRelease: (event) => apply(event.nativeEvent.locationX),
      }),
    [apply],
  );

  function handleLayout(event: LayoutChangeEvent) {
    const width = event.nativeEvent.layout.width;
    if (Math.abs(width - trackWidth) > 0.5) setTrackWidth(width);
  }

  function handleAccessibilityAction(event: AccessibilityActionEvent) {
    const delta = event.nativeEvent.actionName === "increment" ? step : -step;
    const next = Math.min(max, Math.max(min, Math.round((value + delta) / step) * step));
    if (next !== value) onChange(next);
  }

  const display = formatValue ? formatValue(value) : String(value);

  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <Text className="font-inter-semibold text-sm text-foreground">{label}</Text>
        <Text className="font-inter-bold text-lg text-primary">{display}</Text>
      </View>

      <View
        onLayout={handleLayout}
        {...pan.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text: display }}
        accessibilityActions={[
          { name: "increment", label: "Aumenta" },
          { name: "decrement", label: "Diminuisci" },
        ]}
        onAccessibilityAction={handleAccessibilityAction}
        hitSlop={6}
        className="h-11 justify-center"
      >
        <View className="h-2 w-full overflow-hidden rounded-full bg-background">
          <View className="h-2 rounded-full bg-primary" style={{ width: THUMB / 2 + ratio * usable }} />
        </View>
        <View
          pointerEvents="none"
          style={{ left: ratio * usable }}
          className="absolute h-6 w-6 rounded-full border-2 border-primary bg-surface"
        />
      </View>

      {ticks && ticks.length > 0 ? (
        <View className="flex-row justify-between px-0.5">
          {ticks.map((tick, index) => (
            <Text key={`${tick}-${index}`} className="font-sans text-xs text-muted">
              {tick}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
