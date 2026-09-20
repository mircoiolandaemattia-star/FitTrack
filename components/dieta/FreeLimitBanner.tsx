import { Text, View } from "react-native";
import { Crown, Info } from "lucide-react-native";

type FreeLimitBannerProps = {
  used: number;
  limit: number;
};

export function FreeLimitBanner({ used, limit }: FreeLimitBannerProps) {
  return (
    <View className="flex-row items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3.5">
      <View className="mt-0.5">
        <Info size={18} color="#F59E0B" strokeWidth={2.2} />
      </View>
      <View className="flex-1 gap-1">
        <Text className="font-inter-semibold text-sm text-amber-200">
          Hai raggiunto il limite giornaliero ({used}/{limit}). Passa a Premium per foto illimitate
        </Text>
        <Text className="font-sans text-xs leading-4 text-amber-200/70">
          Il riconoscimento foto è limitato a {limit} usi al giorno per gli utenti Free. Con Premium ottieni analisi illimitate.
        </Text>
      </View>
      <View className="rounded-full bg-amber-500/20 px-2.5 py-1">
        <View className="flex-row items-center gap-1">
          <Crown size={12} color="#F59E0B" strokeWidth={2.2} />
          <Text className="font-inter-bold text-xs text-amber-300">Premium</Text>
        </View>
      </View>
    </View>
  );
}
