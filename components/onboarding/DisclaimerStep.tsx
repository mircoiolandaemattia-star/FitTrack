import { Pressable, ScrollView, Text, View } from "react-native";
import { ShieldAlert, Check } from "lucide-react-native";

type Props = {
  accepted: boolean;
  onToggle: (v: boolean) => void;
};

const DISCLAIMER =
  "Le schede di allenamento e i piani alimentari generati dall'intelligenza artificiale hanno scopo puramente informativo e non sostituiscono il parere di un medico, nutrizionista o personal trainer certificato. Prima di iniziare qualsiasi programma di allenamento o alimentare, specialmente se hai patologie pregresse, consulta un professionista qualificato. L'utilizzo dell'app è a tuo rischio e l'azienda non è responsabile per infortuni o problemi di salute derivanti dal suo utilizzo.";

export function DisclaimerStep({ accepted, onToggle }: Props) {
  return (
    <View className="gap-5">
      <View className="flex-row items-center gap-2">
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15">
          <ShieldAlert size={18} color="#F59E0B" />
        </View>
        <Text className="font-inter-bold text-xl text-foreground">Disclaimer legale</Text>
      </View>

      <View className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
        <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
          <Text className="font-sans text-sm leading-6 text-amber-100">{DISCLAIMER}</Text>
        </ScrollView>
      </View>

      <Pressable onPress={() => onToggle(!accepted)} className="flex-row items-start gap-3 rounded-xl border border-border bg-surface p-4 active:opacity-80">
        <View
          className={`mt-0.5 h-6 w-6 items-center justify-center rounded-md border-2 ${accepted ? "border-primary bg-primary" : "border-border bg-transparent"}`}
        >
          {accepted ? <Check size={14} color="#0F172A" strokeWidth={3} /> : null}
        </View>
        <Text className="flex-1 font-inter-semibold text-sm leading-5 text-foreground">Ho letto e accetto le condizioni d'uso</Text>
      </Pressable>
    </View>
  );
}
