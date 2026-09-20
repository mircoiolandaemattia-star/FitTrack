import { Alert, Pressable, Switch, Text, View } from "react-native";
import { Clock, Dumbbell, Trash2, UtensilsCrossed } from "lucide-react-native";
import { Card } from "@/components/home/Card";
import { formatReminder } from "@/lib/reminders";
import type { DayOfWeek } from "@/types";

type ReminderItem = {
  id: string;
  type: string;
  daysOfWeek: DayOfWeek[];
  time: string;
  message: string;
  isActive: boolean;
};

type Props = {
  reminders: ReminderItem[];
  readOnly?: boolean;
  onToggle: (id: string, v: boolean) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
};

export function ReminderCard({ reminders, readOnly = false, onToggle, onDelete, onAdd }: Props) {
  function handleDelete(id: string) {
    if (readOnly) return;
    Alert.alert("Eliminare promemoria?", "Confermi l'eliminazione?", [
      { text: "Annulla", style: "cancel" },
      { text: "Elimina", style: "destructive", onPress: () => onDelete(id) },
    ]);
  }

  return (
    <Card className="gap-4">
      <View className="flex-row items-center justify-between">
        <Text className="font-inter-semibold text-base text-foreground">Promemoria</Text>
        {!readOnly ? (
          <Pressable onPress={onAdd} className="h-9 w-9 items-center justify-center rounded-full bg-primary active:opacity-80">
            <Text className="font-inter-bold text-lg leading-none text-primary-foreground">＋</Text>
          </Pressable>
        ) : null}
      </View>

      {reminders.length === 0 ? (
        <Text className="font-sans text-sm text-muted">Nessun promemoria impostato</Text>
      ) : (
        <View className="gap-2">
          {reminders.map((r) => (
            <View key={r.id} className="flex-row items-center gap-3 rounded-xl border border-border bg-background/40 px-3 py-3">
              <View className={`h-9 w-9 items-center justify-center rounded-xl ${r.type === "palestra" ? "bg-primary/15" : "bg-accent/15"}`}>
                {r.type === "palestra" ? <Dumbbell size={16} color="#F97316" strokeWidth={2.2} /> : <UtensilsCrossed size={16} color="#22C55E" strokeWidth={2.2} />}
              </View>
              <View className="flex-1">
                <Text className="font-inter-semibold text-sm text-foreground" numberOfLines={1}>
                  {formatReminder(r as any)}
                </Text>
                <View className="flex-row items-center gap-1">
                  <Clock size={12} color="#94A3B8" strokeWidth={2.2} />
                  <Text className="font-sans text-xs text-muted">{r.time}</Text>
                </View>
              </View>
              <Switch value={r.isActive} onValueChange={(v) => onToggle(r.id, v)} disabled={readOnly} trackColor={{ true: "#F97316" }} thumbColor="#fff" />
              {!readOnly ? (
                <Pressable onPress={() => handleDelete(r.id)} className="h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 active:opacity-80">
                  <Trash2 size={16} color="#EF4444" strokeWidth={2.2} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      )}

      {!readOnly && reminders.length > 0 ? (
        <Pressable onPress={onAdd} className="flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-background/20 py-3 active:opacity-80">
          <Text className="font-inter-semibold text-sm text-muted">＋ Aggiungi promemoria</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}
