import { Text, View } from "react-native";
import { Clock, Flame, Trophy } from "lucide-react-native";

type Props = {
  streakDays: number;
  sessions: number;
  hours: number;
};

export function WorkoutStatsGrid({ streakDays, sessions, hours }: Props) {
  return (
    <View className="flex-row gap-3">
      <View className="flex-1 items-center gap-1 rounded-2xl border border-border bg-background/40 px-3 py-4">
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
          <Flame size={18} color="#F97316" strokeWidth={2.2} />
        </View>
        <Text className="font-inter-bold text-lg text-foreground">{streakDays}</Text>
        <Text className="text-center font-sans text-xs leading-3 text-muted">giorni streak</Text>
      </View>
      <View className="flex-1 items-center gap-1 rounded-2xl border border-border bg-background/40 px-3 py-4">
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-accent/15">
          <Trophy size={18} color="#22C55E" strokeWidth={2.2} />
        </View>
        <Text className="font-inter-bold text-lg text-foreground">{sessions}</Text>
        <Text className="text-center font-sans text-xs leading-3 text-muted">sessioni</Text>
      </View>
      <View className="flex-1 items-center gap-1 rounded-2xl border border-border bg-background/40 px-3 py-4">
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#38BDF8]/15">
          <Clock size={18} color="#38BDF8" strokeWidth={2.2} />
        </View>
        <Text className="font-inter-bold text-lg text-foreground">{hours}h</Text>
        <Text className="text-center font-sans text-xs leading-3 text-muted">ore totali</Text>
      </View>
    </View>
  );
}
