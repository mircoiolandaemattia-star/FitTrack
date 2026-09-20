import { Pressable, Text, View } from "react-native";
import { Plus, Ruler } from "lucide-react-native";
import type { MeasurementDiff } from "@/lib/progressMock";

type Props = {
  diffs: MeasurementDiff[];
  onAdd: () => void;
  readOnly?: boolean;
};

export function MeasurementsList({ diffs, onAdd, readOnly = false }: Props) {
  if (diffs.length === 0) {
    return (
      <View className="gap-3">
        <View className="rounded-xl border border-border bg-background/20 p-4">
          <Text className="font-sans text-sm text-muted">Nessuna misurazione ancora. Aggiungi la prima.</Text>
        </View>
        {!readOnly ? (
          <Pressable onPress={onAdd} className="flex-row items-center justify-center gap-1.5 rounded-xl bg-primary py-3 active:opacity-80">
            <Plus size={16} color="#0F172A" strokeWidth={2.5} />
            <Text className="font-inter-bold text-sm text-primary-foreground">Aggiungi misurazione</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View className="gap-3">
      {diffs.map((m) => {
        const hasDiff = m.diff !== null;
        const sign = hasDiff && m.diff! > 0 ? "+" : "";
        const diffColor = hasDiff ? (m.diff! < 0 ? "#22C55E" : m.diff! > 0 ? "#EF4444" : "#94A3B8") : "#94A3B8";
        return (
          <View key={m.key} className="flex-row items-center gap-3 rounded-xl border border-border bg-background/40 px-4 py-3">
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Ruler size={16} color="#F97316" strokeWidth={2.2} />
            </View>
            <Text className="flex-1 font-inter-semibold text-sm text-foreground">{m.key}</Text>
            <Text className="font-inter-bold text-sm text-foreground">{m.current} cm</Text>
            {hasDiff ? (
              <Text style={{ color: diffColor }} className="font-inter-semibold text-xs">
                ({sign}
                {m.diff!.toFixed(1)} cm)
              </Text>
            ) : (
              <Text className="font-sans text-xs text-muted">—</Text>
            )}
          </View>
        );
      })}
      {!readOnly ? (
        <Pressable onPress={onAdd} className="flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-background/20 py-3 active:opacity-80">
          <Plus size={16} color="#94A3B8" strokeWidth={2.2} />
          <Text className="font-inter-semibold text-sm text-muted">Aggiungi misurazione</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
