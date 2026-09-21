import { useCallback, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { CheckCircle2, Moon, Plus, X } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/home/Card";
import { useIsStandalone } from "@/lib/useStandalone";
import {
  consumeWorkoutCompletedNotice,
  getDayLabel,
  getTodayDayOfWeek,
  getWorkoutPlan,
  listSessions,
  WEEKDAYS,
} from "@/lib/mock-data";
import { WorkoutDayCard } from "@/components/scheda/WorkoutDayCard";
import { WorkoutHistoryList } from "@/components/scheda/WorkoutHistoryList";
import { CreateWorkoutModal } from "@/components/scheda/CreateWorkoutModal";

const WIDE_BREAKPOINT = 768;

/**
 * Scheda: vista settimanale con card espandibili per giorno, modal di
 * creazione dal bottone "+" e storico delle sessioni. Su desktop/web i
 * bottoni "+" e "Inizia" sono nascosti (sola lettura) e il layout
 * diventa a due colonne.
 */
export default function SchedaScreen() {
  const { width } = useWindowDimensions();
  const isStandalone = useIsStandalone();
  const isWide = width >= WIDE_BREAKPOINT;
  const isInteractive = !(Platform.OS === "web" && !isStandalone);

  const [modalOpen, setModalOpen] = useState(false);
  const [expandedDayId, setExpandedDayId] = useState<string | null>(() => {
    const today = getTodayDayOfWeek();
    return getWorkoutPlan().days.find((day) => day.dayOfWeek === today)?.id ?? null;
  });
  const [planVersion, setPlanVersion] = useState(0);
  const [sessions, setSessions] = useState(() => listSessions());
  const [showCompleted, setShowCompleted] = useState(false);

  const todayKey = getTodayDayOfWeek();

  // Al ritorno dall'allenamento attivo: aggiorna lo storico e mostra il
  // messaggio "Allenamento completato!" (consumato una sola volta).
  useFocusEffect(
    useCallback(() => {
      setSessions(listSessions());
      if (consumeWorkoutCompletedNotice()) {
        setShowCompleted(true);
        const timer = setTimeout(() => setShowCompleted(false), 6000);
        return () => clearTimeout(timer);
      }
    }, []),
  );

  const planDays = getWorkoutPlan().days;
  const daysOrdered = WEEKDAYS.map((weekday) => planDays.find((day) => day.dayOfWeek === weekday));
  const todayId = planDays.find((day) => day.dayOfWeek === todayKey)?.id ?? null;
  // Se il giorno espanso è stato sostituito (upsert), riapri quello di oggi.
  const resolvedExpanded = planDays.some((day) => day.id === expandedDayId)
    ? expandedDayId
    : todayId;

  function toggleDay(id: string) {
    setExpandedDayId((previous) => (previous === id ? null : id));
  }

  function handleModalDone() {
    setPlanVersion((version) => version + 1);
    setSessions(listSessions());
  }

  const weeklyList = (
    <View className="gap-3">
      {daysOrdered.map((day, index) => {
        const weekday = WEEKDAYS[index];
        if (!day) {
          return (
            <Card key={weekday} className="flex-row items-center gap-3 p-4">
              <View className="h-11 w-11 items-center justify-center rounded-xl bg-surface">
                <Moon size={22} color="#64748B" strokeWidth={2.2} />
              </View>
              <View className="flex-1">
                <Text className="font-sans text-xs text-muted">{getDayLabel(weekday)}</Text>
                <Text className="font-inter-semibold text-base text-foreground">
                  Nessun allenamento previsto
                </Text>
              </View>
            </Card>
          );
        }
        return (
          <WorkoutDayCard
            key={day.id}
            day={day}
            isToday={day.dayOfWeek === todayKey}
            expanded={resolvedExpanded === day.id}
            onToggle={() => toggleDay(day.id)}
          />
        );
      })}
    </View>
  );

  const historySection = (
    <View className="gap-4">
      <Text className="font-inter-semibold text-base text-foreground">Storico sessioni</Text>
      <WorkoutHistoryList sessions={sessions} />
    </View>
  );

  return (
    <Screen>
      <ScrollView
        className="flex-1"
        contentContainerClassName={`w-full gap-6 px-4 py-6 ${
          isWide ? "mx-auto max-w-5xl px-6" : ""
        }`}
      >
        {/* Header */}
        <View className="flex-row items-center gap-4">
          <View className="flex-1">
            <Text className="font-inter-bold text-3xl text-foreground">La mia scheda</Text>
            <Text className="mt-1 font-sans text-sm text-muted">
              {isInteractive
                ? "Piano settimanale e storico delle sessioni"
                : "Sola lettura su browser — installa la PWA per modificare"}
            </Text>
          </View>
          {isInteractive ? (
            <Pressable
              onPress={() => setModalOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Crea scheda"
              className="h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-primary active:opacity-80"
            >
              <Plus size={22} color="#0F172A" strokeWidth={2.5} />
            </Pressable>
          ) : null}
        </View>

        {/* Conferma allenamento completato */}
        {showCompleted ? (
          <View className="flex-row items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3.5">
            <CheckCircle2 size={20} color="#22C55E" strokeWidth={2.2} />
            <Text className="flex-1 font-inter-semibold text-sm text-foreground">
              Allenamento completato!
            </Text>
            <Pressable
              onPress={() => setShowCompleted(false)}
              accessibilityRole="button"
              accessibilityLabel="Chiudi messaggio"
              hitSlop={8}
              className="cursor-pointer p-1 active:opacity-60"
            >
              <X size={16} color="#94A3B8" strokeWidth={2.2} />
            </Pressable>
          </View>
        ) : null}

        {isWide ? (
          /* Layout desktop: scheda a sinistra, storico a destra */
          <View className="w-full flex-row items-start gap-6">
            <View className="flex-1 gap-4">
              <Text className="font-inter-semibold text-base text-foreground">
                Piano settimanale
              </Text>
              {weeklyList}
            </View>
            <View className="flex-1">{historySection}</View>
          </View>
        ) : (
          <View className="w-full gap-4">
            <Text className="font-inter-semibold text-base text-foreground">
              Piano settimanale
            </Text>
            {weeklyList}
            {historySection}
          </View>
        )}
      </ScrollView>

      <CreateWorkoutModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onDone={handleModalDone}
      />
    </Screen>
  );
}