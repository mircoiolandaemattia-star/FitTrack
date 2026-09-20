import { useEffect, useState } from "react";
import { Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import { X } from "lucide-react-native";
import type { DayOfWeek } from "@/types";
import { WEEKDAYS, dayLabel } from "@/lib/reminders";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { type: string; daysOfWeek: DayOfWeek[]; time: string; message: string; isActive: boolean }) => void;
};

function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function AddReminderModal({ visible, onClose, onSave }: Props) {
  const [type, setType] = useState<"palestra" | "pasto">("palestra");
  const [days, setDays] = useState<DayOfWeek[]>(["monday"]);
  const [timeDate, setTimeDate] = useState(() => {
    const d = new Date();
    d.setHours(16, 30, 0, 0);
    return d;
  });
  const [message, setMessage] = useState("Vai in palestra");

  useEffect(() => {
    if (!visible) return;
    setType("palestra");
    setDays(["monday"]);
    const d = new Date();
    d.setHours(16, 30, 0, 0);
    setTimeDate(d);
    setMessage("Vai in palestra");
  }, [visible]);

  function toggleDay(d: DayOfWeek) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  function handleSave() {
    if (days.length === 0) return;
    if (!message.trim()) return;
    onSave({ type, daysOfWeek: days, time: formatTime(timeDate), message: message.trim(), isActive: true });
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType={Platform.OS === "web" ? "none" : "slide"} onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 justify-end bg-black/60">
        <View className="max-h-[92%] w-full rounded-t-3xl border-t border-border bg-surface" style={{ maxHeight: "92%" }}>
          <View className="flex-row items-center gap-2 border-b border-border px-3 py-2">
            <Text className="flex-1 font-inter-bold text-lg text-foreground">Aggiungi promemoria</Text>
            <Pressable onPress={onClose} className="h-11 w-11 items-center justify-center rounded-lg active:opacity-60">
              <X size={20} color="#94A3B8" strokeWidth={2.2} />
            </Pressable>
          </View>

          <View className="gap-4 p-4 pb-8">
            {/* Tipo */}
            <View className="gap-2">
              <Text className="font-inter-semibold text-sm text-foreground">Tipo</Text>
              <View className="flex-row gap-2">
                {[
                  { k: "palestra", l: "Palestra" },
                  { k: "pasto", l: "Pasto-Spuntino" },
                ].map((o) => (
                  <Pressable
                    key={o.k}
                    onPress={() => {
                      setType(o.k as any);
                      setMessage(o.k === "palestra" ? "Vai in palestra" : "Registra il pasto");
                    }}
                    className={`flex-1 items-center rounded-xl border px-4 py-3 active:opacity-80 ${type === o.k ? "border-primary bg-primary/15" : "border-border bg-background/40"}`}
                  >
                    <Text className={`font-inter-semibold text-sm ${type === o.k ? "text-primary" : "text-muted"}`}>{o.l}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Giorni */}
            <View className="gap-2">
              <Text className="font-inter-semibold text-sm text-foreground">Giorni</Text>
              <View className="flex-row flex-wrap gap-2">
                {WEEKDAYS.map((d) => {
                  const active = days.includes(d);
                  return (
                    <Pressable
                      key={d}
                      onPress={() => toggleDay(d)}
                      className={`rounded-full border px-3 py-2 active:opacity-80 ${active ? "border-primary bg-primary/15" : "border-border bg-surface"}`}
                    >
                      <Text className={`font-inter-semibold text-sm ${active ? "text-primary" : "text-muted"}`}>{dayLabel(d)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Orario */}
            <View className="gap-2">
              <Text className="font-inter-semibold text-sm text-foreground">Orario (HH:MM)</Text>
              <TextInput
                value={formatTime(timeDate)}
                onChangeText={(t) => {
                  const [hh, mm] = t.split(":").map((x) => parseInt(x, 10));
                  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return;
                  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return;
                  const d = new Date(timeDate);
                  d.setHours(hh, mm);
                  setTimeDate(d);
                }}
                placeholder="16:30"
                placeholderTextColor="#64748B"
                keyboardType={Platform.OS === "web" ? "default" : "numbers-and-punctuation"}
                className="rounded-xl border border-border bg-background px-3 py-3 font-sans text-sm text-foreground"
              />
              <Text className="font-sans text-xs text-muted">Formato 24h, es. 07:30 o 18:45</Text>
            </View>

            {/* Messaggio */}
            <View className="gap-2">
              <Text className="font-inter-semibold text-sm text-foreground">Messaggio</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Es. Vai in palestra"
                placeholderTextColor="#64748B"
                className="rounded-xl border border-border bg-background px-3 py-3 font-sans text-sm text-foreground"
              />
            </View>

            <Pressable
              onPress={handleSave}
              disabled={days.length === 0 || !message.trim()}
              className={`items-center rounded-xl py-3.5 ${days.length === 0 || !message.trim() ? "bg-primary/40 opacity-60" : "bg-primary active:opacity-80"}`}
            >
              <Text className="font-inter-bold text-base text-primary-foreground">Salva</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
