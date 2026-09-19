import { Text, View } from "react-native";
import { Clock, Flame } from "lucide-react-native";
import type { WorkoutSession } from "@/types";
import { getWorkoutDayName } from "@/lib/mock-data";
import { Card } from "@/components/home/Card";

type WorkoutHistoryListProps = {
  sessions: WorkoutSession[];
};

const DATE_FORMATTER = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

function formatDate(iso: string): string {
  try {
    return DATE_FORMATTER.format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Storico delle sessioni: data, giorno di scheda, durata e calorie
 * bruciate. Dati tipizzati WorkoutSession, pronti per l'API.
 */
export function WorkoutHistoryList({ sessions }: WorkoutHistoryListProps) {
  if (sessions.length === 0) {
    return (
      <Card>
        <Text className="font-sans text-sm text-muted">
          Nessuna sessione registrata: completa il primo allenamento!
        </Text>
      </Card>
    );
  }

  return (
    <View className="gap-3">
      {sessions.map((session) => (
        <Card key={session.id} className="p-4">
          <View className="flex-row items-center gap-3">
            <View className="flex-1">
              <Text className="font-inter-semibold text-sm text-foreground">
                {getWorkoutDayName(session.dayId)}
              </Text>
              <Text className="mt-0.5 font-sans text-xs text-muted">
                {formatDate(session.endedAt)}
              </Text>
            </View>

            <View className="flex-row items-center gap-2">
              <View className="flex-row items-center gap-1.5 rounded-lg bg-accent/15 px-2.5 py-1.5">
                <Clock size={14} color="#22C55E" strokeWidth={2.2} />
                <Text className="font-inter-semibold text-xs text-accent">
                  {session.durationMinutes} min
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5 rounded-lg bg-primary/15 px-2.5 py-1.5">
                <Flame size={14} color="#F97316" strokeWidth={2.2} />
                <Text className="font-inter-semibold text-xs text-primary">
                  {session.caloriesBurned} kcal
                </Text>
              </View>
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}