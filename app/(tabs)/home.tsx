import { useMemo } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useAuth } from "@/lib/auth";
import {
  getQuickStats,
  getTodayMeals,
  getTodayWorkoutDay,
  MOCK_CALORIE_TARGET,
  MOCK_CALORIES_CONSUMED,
} from "@/lib/mock-data";
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
 * Home / Dashboard: header con saluto, card calorie, allenamento di oggi,
 * pasti e statistiche. Su schermi larghi (>768px) il layout diventa a 2 colonne.
 */
export default function HomeScreen() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  const data = useMemo(
    () => ({
      greeting: getGreeting(new Date()),
      dateLabel: formatToday(new Date()),
      workoutDay: getTodayWorkoutDay(),
      meals: getTodayMeals(),
      stats: getQuickStats(),
    }),
    [],
  );

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName={`w-full gap-6 px-4 py-6 ${
        isWide ? "mx-auto max-w-5xl px-6" : ""
      }`}
    >
      {/* Header */}
      <View className="w-full">
        <Text className="font-inter-bold text-3xl text-foreground">
          {data.greeting}
          {user?.name ? `, ${user.name}` : ""}
        </Text>
        <Text className="mt-1 font-sans text-sm text-muted">{data.dateLabel}</Text>
      </View>

      {isWide ? (
        /* Layout desktop: 2 colonne */
        <View className="w-full flex-row items-start gap-4">
          <View className="flex-1 gap-4">
            <CalorieRing
              consumed={MOCK_CALORIES_CONSUMED}
              target={MOCK_CALORIE_TARGET}
            />
            <MealsSummaryCard meals={data.meals} />
          </View>
          <View className="flex-1 gap-4">
            <WorkoutTodayCard day={data.workoutDay} />
            <QuickStats stats={data.stats} />
          </View>
        </View>
      ) : (
        /* Layout mobile: tutto verticale */
        <View className="w-full gap-4">
          <CalorieRing consumed={MOCK_CALORIES_CONSUMED} target={MOCK_CALORIE_TARGET} />
          <WorkoutTodayCard day={data.workoutDay} />
          <MealsSummaryCard meals={data.meals} />
          <QuickStats stats={data.stats} />
        </View>
      )}
    </ScrollView>
  );
}