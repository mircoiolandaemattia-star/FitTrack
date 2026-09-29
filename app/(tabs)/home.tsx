import { useMemo } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import { Screen } from "@/components/Screen";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { useAuth } from "@/lib/auth";
import { dateToString } from "@/lib/dietaStore";
import { useDiaryDay } from "@/lib/dietQueries";
import { getTodayDayOfWeek, type QuickStats as QuickStatsData } from "@/lib/mock-data";
import { useProfile } from "@/lib/profileQueries";
import { useWorkoutPlan, useWorkoutPlans, useWorkoutSessions } from "@/lib/workoutQueries";
import type { WorkoutSession } from "@/types";
import { CalorieRing } from "@/components/home/CalorieRing";
import { WorkoutTodayCard } from "@/components/home/WorkoutTodayCard";
import { MealsSummaryCard } from "@/components/home/MealsSummaryCard";
import { QuickStats } from "@/components/home/QuickStats";

const WIDE_BREAKPOINT = 768; // px

function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
}

function formatToday(date: Date): string {
  const label = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Statistiche rapide derivate dalle sessioni salvate:
 * - **streak**: giorni consecutivi con almeno una sessione; se oggi non ce
 *   n'è ancora parte da ieri, così non si azzera al mattino;
 * - **ore settimanali**: durata delle sessioni dalla mezzanotte di lunedì;
 * - **sessioni totali**: tutte le sessioni chiuse.
 */
function computeQuickStats(sessions: WorkoutSession[]): QuickStatsData {
  const today = new Date();
  const dayKeys = new Set(sessions.map((session) => dateToString(new Date(session.startedAt))));

  const weekStart = new Date(today);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weeklyMinutes = sessions
    .filter((session) => new Date(session.startedAt) >= weekStart)
    .reduce((sum, session) => sum + session.durationMinutes, 0);

  const cursor = new Date(today);
  cursor.setHours(0, 0, 0, 0);
  if (!dayKeys.has(dateToString(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streakDays = 0;
  while (dayKeys.has(dateToString(cursor))) {
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    streakDays,
    weeklyHours: Math.round((weeklyMinutes / 60) * 10) / 10,
    totalSessions: sessions.length,
  };
}

/**
 * Home / Dashboard: header con saluto, card calorie, allenamento di oggi,
 * pasti e statistiche — dati reali dal backend (profilo, diario, scheda
 * attiva, sessioni). Su schermi larghi (>768px) il layout diventa a 2 colonne.
 */
export default function HomeScreen() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  const today = useMemo(() => dateToString(new Date()), []);

  const profileQuery = useProfile();
  const diary = useDiaryDay(today);
  const plansQuery = useWorkoutPlans();
  const activePlanId =
    plansQuery.data?.find((plan) => plan.isActive)?.id ?? plansQuery.data?.[0]?.id ?? null;
  const planQuery = useWorkoutPlan(activePlanId);
  const sessionsQuery = useWorkoutSessions();

  const displayName = useMemo(() => {
    if (!user?.name) return "";
    const first = user.name.trim().split(/\s+/)[0];
    if (!first) return "";
    return first.charAt(0).toUpperCase() + first.slice(1);
  }, [user?.name]);

  const target = profileQuery.data?.daily_calorie_target ?? 0;
  const consumed = diary.totals.calories;

  // Solo pasti con almeno un alimento: i gruppi vuoti non sono pasti fatti.
  const mealsToday = useMemo(
    () => diary.meals.filter((meal) => meal.foodItems.length > 0),
    [diary.meals],
  );

  // Giorno programmato per oggi: nessun giorno → il card mostra il riposo.
  const workoutDay = useMemo(
    () => planQuery.data?.days.find((day) => day.dayOfWeek === getTodayDayOfWeek()) ?? null,
    [planQuery.data],
  );

  const stats = useMemo(
    () => computeQuickStats(sessionsQuery.data ?? []),
    [sessionsQuery.data],
  );

  const data = useMemo(
    () => ({
      greeting: getGreeting(new Date()),
      dateLabel: formatToday(new Date()),
    }),
    [],
  );

  return (
    <Screen>
      <ScrollView
        className="flex-1"
        contentContainerClassName={`w-full gap-6 px-4 py-6 ${
          isWide ? "mx-auto max-w-5xl px-6" : ""
        }`}
      >
        {/* Header — fix Android: safe-area via Screen + wrapping + capitalizzazione nome */}
        <View className="w-full gap-1">
          <Text
            className="font-inter-bold text-[28px] leading-[34px] text-foreground"
            numberOfLines={2}
            style={{ flexShrink: 1 }}
          >
            {data.greeting}
            {displayName ? `, ${displayName}` : ""}
          </Text>
          <Text className="font-sans text-sm leading-5 text-muted">{data.dateLabel}</Text>
        </View>

        <PWAInstallBanner />

      {isWide ? (
        /* Layout desktop: 2 colonne */
        <View className="w-full flex-row items-start gap-4">
          <View className="flex-1 gap-4">
            <CalorieRing consumed={consumed} target={target} />
            <MealsSummaryCard meals={mealsToday} />
          </View>
          <View className="flex-1 gap-4">
            <WorkoutTodayCard day={workoutDay} />
            <QuickStats stats={stats} />
          </View>
        </View>
      ) : (
        /* Layout mobile: tutto verticale */
        <View className="w-full gap-4">
          <CalorieRing consumed={consumed} target={target} />
          <WorkoutTodayCard day={workoutDay} />
          <MealsSummaryCard meals={mealsToday} />
          <QuickStats stats={stats} />
        </View>
      )}
      </ScrollView>
    </Screen>
  );
}
