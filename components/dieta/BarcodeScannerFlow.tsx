import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Barcode, Package } from "lucide-react-native";
import type { DietFoodDraft } from "@/types";
import { MOCK_BARCODE_PRODUCT } from "@/lib/dietaStore";

const QUICK_GRAMS = [50, 100, 150, 200];

type BarcodeScannerFlowProps = {
  onAdd: (draft: DietFoodDraft) => void;
};

export function BarcodeScannerFlow({ onAdd }: BarcodeScannerFlowProps) {
  const [scanned, setScanned] = useState(false);
  const [grams, setGrams] = useState("100");

  const gramsNum = parseInt(grams, 10) || 0;
  const factor = gramsNum / 100;

  const draft: DietFoodDraft | null = useMemo(() => {
    if (!scanned) return null;
    const p = MOCK_BARCODE_PRODUCT.per100g;
    return {
      id: `barcode-${Date.now()}`,
      name: MOCK_BARCODE_PRODUCT.name,
      quantityG: gramsNum,
      calories: Math.round(p.calories * factor),
      proteinG: Math.round(p.proteinG * factor * 10) / 10,
      carbsG: Math.round(p.carbsG * factor * 10) / 10,
      fatsG: Math.round(p.fatsG * factor * 10) / 10,
    };
  }, [scanned, gramsNum, factor]);

  if (!scanned) {
    return (
      <View className="gap-4">
        <View className="items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-background/20 py-8">
          <View className="h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
            <Barcode size={36} color="#F97316" strokeWidth={1.8} />
          </View>
          <Text className="font-inter-semibold text-sm text-foreground">Inquadra il codice a barre</Text>
          <Text className="px-6 text-center font-sans text-xs leading-4 text-muted">
            Posiziona il codice all'interno dell'area di scansione. Su Expo usiamo un overlay mock.
          </Text>
          <View className="mt-2 h-28 w-56 overflow-hidden rounded-xl border-2 border-primary/50 bg-black/40">
            <View className="flex-1 items-center justify-center">
              <View className="h-[2px] w-40 bg-primary/80" />
              <Text className="mt-2 font-sans text-xs text-primary">Area di scansione</Text>
            </View>
          </View>
        </View>
        <Pressable onPress={() => setScanned(true)} className="flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3.5 active:opacity-80">
          <Package size={18} color="#0F172A" strokeWidth={2.2} />
          <Text className="font-inter-bold text-base text-primary-foreground">Simula scansione</Text>
        </Pressable>
        <Text className="text-center font-sans text-xs text-muted">Sempre disponibile anche per utenti Free, nessun limite</Text>
      </View>
    );
  }

  return (
    <View className="gap-4">
      <View className="rounded-xl border border-border bg-background/40 p-4">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
            <Package size={18} color="#F97316" strokeWidth={2.2} />
          </View>
          <View className="flex-1">
            <Text className="font-inter-semibold text-sm text-foreground">{MOCK_BARCODE_PRODUCT.name}</Text>
            <Text className="font-sans text-xs text-muted">
              {MOCK_BARCODE_PRODUCT.brand} · {MOCK_BARCODE_PRODUCT.barcode}
            </Text>
          </View>
        </View>
        <View className="mt-3 flex-row gap-2">
          <View className="flex-1 items-center rounded-lg bg-surface px-2 py-2">
            <Text className="font-sans text-xs text-muted">kcal/100g</Text>
            <Text className="font-inter-bold text-sm text-foreground">{MOCK_BARCODE_PRODUCT.per100g.calories}</Text>
          </View>
          <View className="flex-1 items-center rounded-lg bg-surface px-2 py-2">
            <Text className="font-sans text-xs text-muted">P/100g</Text>
            <Text className="font-inter-bold text-sm text-foreground">{MOCK_BARCODE_PRODUCT.per100g.proteinG}g</Text>
          </View>
          <View className="flex-1 items-center rounded-lg bg-surface px-2 py-2">
            <Text className="font-sans text-xs text-muted">C/100g</Text>
            <Text className="font-inter-bold text-sm text-foreground">{MOCK_BARCODE_PRODUCT.per100g.carbsG}g</Text>
          </View>
          <View className="flex-1 items-center rounded-lg bg-surface px-2 py-2">
            <Text className="font-sans text-xs text-muted">G/100g</Text>
            <Text className="font-inter-bold text-sm text-foreground">{MOCK_BARCODE_PRODUCT.per100g.fatsG}g</Text>
          </View>
        </View>
      </View>

      <View className="gap-2">
        <Text className="font-inter-semibold text-sm text-foreground">Quantità consumata (g)</Text>
        <TextInput
          value={grams}
          onChangeText={setGrams}
          keyboardType="numeric"
          placeholder="100"
          placeholderTextColor="#64748B"
          className="rounded-xl border border-border bg-surface px-3 py-3 text-center font-inter-semibold text-base text-foreground"
        />
        <View className="flex-row gap-2">
          {QUICK_GRAMS.map((g) => (
            <Pressable key={g} onPress={() => setGrams(String(g))} className={`flex-1 items-center rounded-full border py-2.5 active:opacity-80 ${grams === String(g) ? "border-primary bg-primary/15" : "border-border bg-surface"}`}>
              <Text className={`font-inter-semibold text-sm ${grams === String(g) ? "text-primary" : "text-muted"}`}>{g}g</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {draft ? (
        <View className="rounded-xl border border-primary/20 bg-primary/10 p-3">
          <Text className="text-center font-sans text-xs text-muted">Ricalcolo automatico</Text>
          <Text className="mt-1 text-center font-inter-bold text-base text-foreground">
            {draft.calories} kcal · P {draft.proteinG}g · C {draft.carbsG}g · G {draft.fatsG}g
          </Text>
          <Text className="text-center font-sans text-xs text-muted">{draft.quantityG}g</Text>
        </View>
      ) : null}

      <Pressable
        onPress={() => draft && onAdd(draft)}
        disabled={!draft || gramsNum <= 0}
        className={`items-center rounded-xl py-3.5 ${!draft || gramsNum <= 0 ? "bg-primary/40 opacity-60" : "bg-primary active:opacity-80"}`}
      >
        <Text className="font-inter-bold text-base text-primary-foreground">Conferma e aggiungi</Text>
      </Pressable>

      <Pressable onPress={() => setScanned(false)} className="items-center rounded-xl border border-border bg-background/60 py-3 active:opacity-80">
        <Text className="font-inter-semibold text-sm text-muted">Scansiona altro prodotto</Text>
      </Pressable>
    </View>
  );
}
