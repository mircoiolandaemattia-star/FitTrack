import { View, Text } from "react-native";
import { Clock, Dumbbell, Flame } from "lucide-react-native";
import type { QuickStats as QuickStatsData } from "@/lib/mock-data";
import { Card } from "./Card";

type QuickStatsProps = {
  stats: QuickStatsData;
};

const formatHours = (hours: number) => `${hours}h`;

function StatItem({
  icon,
  value,
  label,
  accentClassName,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  accentClassName: string;
}) {
  return (
    <View className="flex-1 items-center gap-2 rounded-xl bg-background/60 px-2 py-4">
      <View className={`h-10 w-10 items-center justify-center rounded-full ${accentClassName}`}>
        {icon}
      </View>
      <Text className="font-inter-bold text-lg text-foreground">{value}</Text>
      <Text className="text-center font-sans text-xs leading-4 text-muted">{label}</Text>
    </View>
  );
}

/**
 * Tre card affiancate: streak allenamenti, ore settimanali, sessioni totali.
 */
export function QuickStats({ stats }: QuickStatsProps) {
  return (
    <Card>
      <Text className="font-inter-semibold text-base text-foreground">Statistiche</Text>
      <View className="mt-4 flex-row gap-2">
        <StatItem
          icon={<Flame size={18} color="#F97316" strokeWidth={2.2} />}
          value={`${stats.streakDays} gg`}
          label="Streak"
          accentClassName="bg-primary/15"
        />
        <StatItem
          icon={<Clock size={18} color="#22C55E" strokeWidth={2.2} />}
          value={formatHours(stats.weeklyHours)}
          label="Questa settimana"
          accentClassName="bg-accent/15"
        />
        <StatItem
          icon={<Dumbbell size={18} color="#38BDF8" strokeWidth={2.2} />}
          value={`${stats.totalSessions}`}
          label="Sessioni totali"
          accentClassName="bg-sky-500/15"
        />
      </View>
    </Card>
  );
}