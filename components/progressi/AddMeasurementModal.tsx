import { useEffect, useState } from "react";
import { Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import { X } from "lucide-react-native";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { weightKg: number; waistCm?: number; hipsCm?: number; chestCm?: number; armsCm?: number }) => void;
};

export function AddMeasurementModal({ visible, onClose, onSave }: Props) {
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [hips, setHips] = useState("");
  const [chest, setChest] = useState("");
  const [arms, setArms] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setWeight("");
    setWaist("");
    setHips("");
    setChest("");
    setArms("");
    setError(null);
  }, [visible]);

  const todayLabel = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "long", year: "numeric" }).format(new Date());

  function handleSave() {
    const w = parseFloat(weight.replace(",", "."));
    if (!w || w <= 0) {
      setError("Inserisci il peso (kg) — campo obbligatorio.");
      return;
    }
    const parseOpt = (v: string): number | undefined => {
      const n = parseFloat(v.replace(",", "."));
      return n > 0 ? n : undefined;
    };
    onSave({
      weightKg: w,
      waistCm: parseOpt(waist),
      hipsCm: parseOpt(hips),
      chestCm: parseOpt(chest),
      armsCm: parseOpt(arms),
    });
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType={Platform.OS === "web" ? "none" : "slide"} onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 justify-end bg-black/60">
        <View className="max-h-[92%] w-full rounded-t-3xl border-t border-border bg-surface" style={{ maxHeight: "92%" }}>
          <View className="flex-row items-center gap-2 border-b border-border px-3 py-2">
            <Text className="flex-1 font-inter-bold text-lg text-foreground">Aggiungi misurazione</Text>
            <Pressable onPress={onClose} className="h-11 w-11 items-center justify-center rounded-lg active:opacity-60">
              <X size={20} color="#94A3B8" strokeWidth={2.2} />
            </Pressable>
          </View>

          <View className="gap-4 p-4 pb-8">
            <Text className="font-sans text-xs text-muted">Data: {todayLabel} (automatica)</Text>

            <View className="gap-1.5">
              <Text className="font-inter-semibold text-sm text-foreground">Peso (kg) *</Text>
              <TextInput
                value={weight}
                onChangeText={setWeight}
                keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                placeholder="Es. 77.2"
                placeholderTextColor="#64748B"
                className="rounded-xl border border-border bg-background px-3 py-3 font-sans text-sm text-foreground"
              />
            </View>

            {[
              { label: "Vita (cm)", value: waist, setter: setWaist, ph: "Es. 82" },
              { label: "Fianchi (cm)", value: hips, setter: setHips, ph: "Es. 96" },
              { label: "Petto (cm)", value: chest, setter: setChest, ph: "Es. 101" },
              { label: "Braccia (cm)", value: arms, setter: setArms, ph: "Es. 32" },
            ].map((f) => (
              <View key={f.label} className="gap-1.5">
                <Text className="font-sans text-sm text-muted">{f.label}</Text>
                <TextInput
                  value={f.value}
                  onChangeText={f.setter}
                  keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                  placeholder={f.ph}
                  placeholderTextColor="#64748B"
                  className="rounded-xl border border-border bg-background px-3 py-3 font-sans text-sm text-foreground"
                />
              </View>
            ))}

            {error ? <Text className="font-sans text-sm text-destructive">{error}</Text> : null}

            <Pressable onPress={handleSave} className="items-center rounded-xl bg-primary py-3.5 active:opacity-80">
              <Text className="font-inter-bold text-base text-primary-foreground">Salva</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
