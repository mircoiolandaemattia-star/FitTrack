import { useMemo, useState } from "react";
import { Platform, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/home/Card";
import { PeriodSelector } from "@/components/progressi/PeriodSelector";
import { WeightChart } from "@/components/progressi/WeightChart";
import { CalorieChart } from "@/components/progressi/CalorieChart";
import { WorkoutStatsGrid } from "@/components/progressi/WorkoutStatsGrid";
import { ProgressPhotoGrid } from "@/components/progressi/ProgressPhotoGrid";
import { MeasurementsList } from "@/components/progressi/MeasurementsList";
import { AddMeasurementModal } from "@/components/progressi/AddMeasurementModal";
import {
  addMeasurement,
  addPhoto,
  getCalorieData,
  getCurrentMeasurementDiffs,
  getWeightData,
  getWorkoutStats,
  listMeasurements,
  listPhotos,
  type Period,
} from "@/lib/progressMock";

const WIDE_BP = 768;

export default function ProgressiScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BP;
  const isReadOnly = Platform.OS === "web" || isWide;

  const [period, setPeriod] = useState<Period>("week");
  const [version, setVersion] = useState(0);
  const [showMeasureModal, setShowMeasureModal] = useState(false);

  // force recompute when period or version changes
  const weight = useMemo(() => getWeightData(period), [period]);
  const calories = useMemo(() => getCalorieData(period), [period]);
  const stats = useMemo(() => getWorkoutStats(period), [period]);
  const photos = useMemo(() => listPhotos(), [version]);
  const diffs = useMemo(() => getCurrentMeasurementDiffs(), [version]);

  // keep measurements list for potential future use
  useMemo(() => listMeasurements(), [version]);

  function bump() {
    setVersion((v) => v + 1);
  }

  const weightCard = (
    <Card className="gap-2">
      <Text className="font-inter-semibold text-sm text-foreground">Andamento peso</Text>
      <WeightChart points={weight.points} current={weight.current} delta={weight.delta} goalOk={weight.goalOk} />
    </Card>
  );

  const calorieCard = (
    <Card className="gap-2">
      <Text className="font-inter-semibold text-sm text-foreground">Calorie giornaliere</Text>
      <CalorieChart average={calories.average} target={calories.target} days={calories.days} />
    </Card>
  );

  const statsCard = (
    <Card className="gap-3">
      <Text className="font-inter-semibold text-sm text-foreground">Statistiche allenamento</Text>
      <WorkoutStatsGrid streakDays={stats.streakDays} sessions={stats.sessions} hours={stats.hours} />
    </Card>
  );

  const photosCard = (
    <Card className="gap-3">
      <Text className="font-inter-semibold text-sm text-foreground">Foto progressi</Text>
      <ProgressPhotoGrid
        photos={photos}
        readOnly={isReadOnly}
        onAdd={(uri) => {
          addPhoto(uri);
          bump();
        }}
      />
    </Card>
  );

  const measurementsCard = (
    <Card className="gap-3">
      <Text className="font-inter-semibold text-sm text-foreground">Misurazioni corporee</Text>
      <MeasurementsList diffs={diffs} readOnly={isReadOnly} onAdd={() => setShowMeasureModal(true)} />
    </Card>
  );

  return (
    <Screen>
      <ScrollView className="flex-1" contentContainerClassName={`w-full gap-6 px-4 py-6 ${isWide ? "mx-auto max-w-5xl px-6" : ""}`}>
        {/* Header */}
        <View className="gap-4">
          <Text className="font-inter-bold text-3xl text-foreground">Progressi</Text>
          <PeriodSelector value={period} onChange={setPeriod} />
        </View>

        {isWide ? (
          <View className="w-full flex-row items-start gap-6">
            <View className="flex-1 gap-6">
              {weightCard}
              {statsCard}
              {measurementsCard}
            </View>
            <View className="flex-1 gap-6">
              {calorieCard}
              {photosCard}
              {isReadOnly ? (
                <View className="rounded-2xl border border-border bg-surface px-4 py-3">
                  <Text className="text-center font-sans text-sm text-muted">Sola lettura su web/desktop — usa l'app mobile per aggiungere foto e misurazioni</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <>
            {weightCard}
            {calorieCard}
            {statsCard}
            {photosCard}
            {measurementsCard}
          </>
        )}
      </ScrollView>

      <AddMeasurementModal
        visible={showMeasureModal}
        onClose={() => setShowMeasureModal(false)}
        onSave={(data) => {
          addMeasurement({ weightKg: data.weightKg, waistCm: data.waistCm ?? 0, hipsCm: data.hipsCm ?? 0, chestCm: data.chestCm ?? 0, armsCm: data.armsCm ?? 0 });
          bump();
        }}
      />
    </Screen>
  );
}
