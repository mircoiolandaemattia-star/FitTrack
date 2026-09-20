import { Modal, Platform, Pressable, Text, View } from "react-native";
import { Crown, Sparkles, X } from "lucide-react-native";

type PremiumUpsellModalProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
};

export function PremiumUpsellModal({ visible, onClose, title, description }: PremiumUpsellModalProps) {
  return (
    <Modal visible={visible} transparent animationType={Platform.OS === "web" ? "none" : "fade"} onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 items-center justify-center bg-black/60 px-4">
        <View className="w-full max-w-md rounded-3xl border border-amber-500/20 bg-surface p-6">
          <View className="flex-row items-center justify-between">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15">
              <Crown size={20} color="#F59E0B" strokeWidth={2.2} />
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Chiudi" className="h-10 w-10 items-center justify-center rounded-full active:opacity-60">
              <X size={18} color="#94A3B8" strokeWidth={2.2} />
            </Pressable>
          </View>
          <Text className="mt-4 font-inter-bold text-xl text-foreground">{title ?? "Funzione Premium"}</Text>
          <Text className="mt-2 font-sans text-sm leading-5 text-muted">
            {description ?? "Questa funzione è disponibile solo per gli utenti Premium o in prova. Passa a Premium per sbloccare tutte le funzionalità."}
          </Text>
          <View className="mt-5 gap-2">
            <Pressable onPress={onClose} className="flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3.5 active:opacity-80">
              <Sparkles size={18} color="#0F172A" strokeWidth={2.2} />
              <Text className="font-inter-bold text-base text-primary-foreground">Passa a Premium</Text>
            </Pressable>
            <Pressable onPress={onClose} className="items-center rounded-xl border border-border bg-background/40 py-3.5 active:opacity-80">
              <Text className="font-inter-semibold text-sm text-muted">Continua con Free</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
