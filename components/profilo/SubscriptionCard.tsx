import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/home/Card";
import { Check, Crown } from "lucide-react-native";

export type SubscriptionState = "free" | "trial" | "premium";
type Props = {
  state: SubscriptionState;
  trialEndsAt?: string | null; // ISO
  nextRenewal?: string | null;
  readOnly?: boolean;
  onStartTrial?: () => void;
  onConfirm?: () => void;
  onManage?: () => void;
};

function daysLeft(iso: string): number {
  const end = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
}

export function SubscriptionCard({ state, trialEndsAt, nextRenewal, readOnly = false, onStartTrial, onConfirm, onManage }: Props) {
  const benefits = ["Foto illimitate", "Generazione scheda AI", "Generazione dieta AI", "Caricamento file"];

  if (state === "free") {
    return (
      <Card className="gap-4">
        <View className="flex-row items-center gap-2">
          <View className="rounded-full bg-border px-3 py-1">
            <Text className="font-inter-bold text-xs text-muted">Free</Text>
          </View>
          <Text className="font-inter-semibold text-base text-foreground">Abbonamento</Text>
        </View>
        <Text className="font-inter-semibold text-sm text-foreground">Prova Premium gratis per 30 giorni!</Text>
        <View className="gap-1.5">
          {benefits.map((b) => (
            <View key={b} className="flex-row items-center gap-2">
              <Check size={14} color="#22C55E" strokeWidth={2.5} />
              <Text className="font-sans text-sm text-muted">{b}</Text>
            </View>
          ))}
        </View>
        <Text className="font-sans text-xs text-muted">25€/anno dopo la prova</Text>
        <Pressable
          disabled={readOnly}
          onPress={onStartTrial}
          className={`flex-row items-center justify-center gap-2 rounded-xl py-3.5 active:opacity-80 ${readOnly ? "bg-primary/40 opacity-60" : "bg-primary"}`}
        >
          <Crown size={16} color="#0F172A" strokeWidth={2.2} />
          <Text className="font-inter-bold text-sm text-primary-foreground">Inizia prova gratuita</Text>
        </Pressable>
      </Card>
    );
  }

  if (state === "trial") {
    const left = trialEndsAt ? daysLeft(trialEndsAt) : 0;
    return (
      <Card className="gap-4">
        <View className="flex-row items-center gap-2">
          <View className="rounded-full bg-amber-500/15 px-3 py-1">
            <Text className="font-inter-bold text-xs text-amber-400">Premium (prova)</Text>
          </View>
        </View>
        <Text className="font-inter-semibold text-sm text-foreground">{left} giorni rimanenti</Text>
        <Text className="font-sans text-xs text-muted">La prova scade il {trialEndsAt ? new Date(trialEndsAt).toLocaleDateString("it-IT") : "—"}</Text>
        <Pressable
          disabled={readOnly}
          onPress={onConfirm}
          className={`items-center rounded-xl py-3.5 active:opacity-80 ${readOnly ? "bg-primary/40 opacity-60" : "bg-primary"}`}
        >
          <Text className="font-inter-bold text-sm text-primary-foreground">Conferma abbonamento (25€/anno)</Text>
        </Pressable>
      </Card>
    );
  }

  // premium
  return (
    <Card className="gap-4">
      <View className="flex-row items-center gap-2">
        <View className="rounded-full bg-primary/15 px-3 py-1">
          <Text className="font-inter-bold text-xs text-primary">Premium</Text>
        </View>
        <Crown size={14} color="#F97316" strokeWidth={2.2} />
      </View>
      <Text className="font-sans text-sm text-muted">Prossimo rinnovo: {nextRenewal ? new Date(nextRenewal).toLocaleDateString("it-IT") : "—"}</Text>
      <View className="gap-1.5">
        {benefits.map((b) => (
          <View key={b} className="flex-row items-center gap-2">
            <Check size={14} color="#22C55E" strokeWidth={2.5} />
            <Text className="font-sans text-sm text-muted">{b}</Text>
          </View>
        ))}
      </View>
      <Pressable
        disabled={readOnly}
        onPress={onManage}
        className={`items-center rounded-xl border border-border bg-background/40 py-3.5 active:opacity-80 ${readOnly ? "opacity-60" : ""}`}
      >
        <Text className="font-inter-semibold text-sm text-foreground">Gestisci abbonamento</Text>
      </Pressable>
    </Card>
  );
}
