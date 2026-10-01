import { Pressable, Switch, Text, View } from "react-native";
import { Bell, Clock, Dumbbell, Ruler, Trash2, UtensilsCrossed } from "lucide-react-native";
import { Card } from "@/components/home/Card";
import { confirmAction } from "@/lib/feedback";
import { formatReminder } from "@/lib/reminderQueries";
import type { Reminder } from "@/types";

type Props = {
  /** Valori `type` del backend: "workout" | "meal" | "measurement" | "custom". */
  reminders: Reminder[];
  readOnly?: boolean;
  onToggle: (id: string, v: boolean) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
};

/** Icona e sfondo per tipo: l'API non parla di "palestra"/"pasto". */
type TypeStyle = { icon: typeof Dumbbell; color: string; bg: string };

const TYPE_STYLE: Record<string, TypeStyle> = {
  workout: { icon: Dumbbell, color: "#F97316", bg: "bg-primary/15" },
  meal: { icon: UtensilsCrossed, color: "#22C55E", bg: "bg-accent/15" },
  measurement: { icon: Ruler, color: "#60A5FA", bg: "bg-accent/15" },
};

/** Tipo non riconosciuto → campanella neutra. */
function typeStyle(type: string): TypeStyle {
  return TYPE_STYLE[type] ?? { icon: Bell, color: "#94A3B8", bg: "bg-accent/15" };
}

export function ReminderCard({ reminders, readOnly = false, onToggle, onDelete, onAdd }: Props) {
  async function handleDelete(id: string) {
    if (readOnly) return;
    const confirmed = await confirmAction({
      title: "Eliminare promemoria?",
      message: "Confermi l'eliminazione?",
      confirmLabel: "Elimina",
      destructive: true,
    });
    if (!confirmed) return;
    onDelete(id);
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
          {reminders.map((r) => {
            const style = typeStyle(r.type);
            const Icon = style.icon;
            return (
              <View key={r.id} className="flex-row items-center gap-3 rounded-xl border border-border bg-background/40 px-3 py-3">
                <View className={`h-9 w-9 items-center justify-center rounded-xl ${style.bg}`}>
                  <Icon size={16} color={style.color} strokeWidth={2.2} />
                </View>
                <View className="flex-1">
                  <Text className="font-inter-semibold text-sm text-foreground" numberOfLines={1}>
                    {formatReminder(r)}
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
            );
          })}
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
