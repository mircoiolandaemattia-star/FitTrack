import { useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { RefreshCw } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/home/Card";
import { useIsStandalone } from "@/lib/useStandalone";
import { isApiError } from "@/lib/api";
import { useProfile } from "@/lib/profileQueries";
import { useWorkoutSessions } from "@/lib/workoutQueries";
import { PeriodSelector } from "@/components/progressi/PeriodSelector";
import { WeightChart } from "@/components/progressi/WeightChart";
import { CalorieChart } from "@/components/progressi/CalorieChart";
import { WorkoutStatsGrid } from "@/components/progressi/WorkoutStatsGrid";
import { ProgressPhotoGrid } from "@/components/progressi/ProgressPhotoGrid";
import { MeasurementsList } from "@/components/progressi/MeasurementsList";
import { AddMeasurementModal } from "@/components/progressi/AddMeasurementModal";
import {
  deriveWorkoutStats,
  measurementDiffs,
  periodRange,
  toISODate,
  useAddMeasurement,
  useCalorieSeries,
  useProgressPhotos,
  useUploadProgressPhoto,
  useWeightSeries,
  type Period,
} from "@/lib/progressQueries";

const WIDE_BP = 768;

/** Messaggio d'errore leggibile: quello dell'API o una rete assente. */
function errorMessage(error: unknown): string {
  return isApiError(error) ? error.message : "Connessione al server non riuscita.";
}

/**
 * Progressi: peso e misurazioni da body_measurements, foto da
 * progress-photos (con filtro periodo sui parametri query), statistiche
 * allenamento derivate da workout-sessions e calorie giornaliere dai
 * meals/food_items del periodo — tutto con React Query. L'upload delle
 * foto carica l'immagine su Supabase Storage e salva il percorso sul
 * backend (bucket privato, mostato con URL firmati).
 */
export default function ProgressiScreen() {
  const { width } = useWindowDimensions();
  const isStandalone = useIsStandalone();
  const isWide = width >= WIDE_BP;
  const isReadOnly = Platform.OS === "web" && !isStandalone;

  const [period, setPeriod] = useState<Period>("week");
  const [showMeasureModal, setShowMeasureModal] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Il periodo cambia i parametri ?from=&to= di misurazioni, foto e pasti.
  const range = useMemo(() => periodRange(period), [period]);
  const weight = useWeightSeries(range.from, range.to);
  const calories = useCalorieSeries(range.from, range.to);
  const photos = useProgressPhotos(range.from, range.to);
  const sessionsQuery = useWorkoutSessions();
  const profileQuery = useProfile(); // target calorie per il grafico
  const addMeasurement = useAddMeasurement();
  const uploadPhoto = useUploadProgressPhoto();

  const stats = deriveWorkoutStats(sessionsQuery.data ?? [], range.from, range.to);
  const diffs = measurementDiffs(weight.measurements);
  const calorieTarget = profileQuery.data?.daily_calorie_target ?? 0;

  const isLoading =
    weight.isLoading ||
    calories.isLoading ||
    photos.isLoading ||
    sessionsQuery.isLoading ||
    profileQuery.isLoading;
  const isError = weight.isError || calories.isError || photos.isError || sessionsQuery.isError;
  const error =
    weight.error ?? calories.error ?? photos.error ?? sessionsQuery.error ?? null;

  function refetch() {
    if (weight.isError) weight.refetch();
    if (calories.isError) calories.refetch();
    if (photos.isError) void photos.refetch();
    if (sessionsQuery.isError) void sessionsQuery.refetch();
  }

  /** Foto scelta → Supabase Storage → riga su /progress-photos (data: oggi). */
  async function uploadPicked(result: ImagePicker.ImagePickerResult) {
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.base64) {
      setSaveError("Non sono riuscito a leggere l’immagine selezionata.");
      return;
    }
    setSaveError(null);
    try {
      await uploadPhoto.mutateAsync({
        date: toISODate(new Date()),
        base64: asset.base64,
        mimeType: asset.mimeType ?? "image/jpeg",
      });
    } catch (err) {
      // Il backend parla italiano; i fallimenti di Storage arrivano come
      // Error con un messaggio già leggibile (RLS, dimensione, formato).
      setSaveError(
        isApiError(err)
          ? err.message
          : err instanceof Error && err.message
            ? err.message
            : "Caricamento non riuscito: riprova.",
      );
    }
  }

  async function pickFromLibrary() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        base64: true,
      });
      await uploadPicked(result);
    } catch {
      setSaveError("Non sono riuscito ad aprire la galleria.");
    }
  }

  async function takePhoto() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setSaveError("Per scattare la foto serve il permesso di usare la fotocamera.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        base64: true,
      });
      await uploadPicked(result);
    } catch {
      setSaveError("Non sono riuscito a scattare la foto.");
    }
  }

  /**
   * "Aggiungi foto": su native si sceglie fra fotocamera e galleria,
   * nella PWA (dove la fotocamera non è disponibile) solo la galleria.
   */
  function handleAddPhoto() {
    if (uploadPhoto.isPending) return;
    if (Platform.OS === "web") {
      void pickFromLibrary();
      return;
    }
    Alert.alert("Aggiungi foto", "Da dove prendi la foto?", [
      { text: "Annulla", style: "cancel" },
      { text: "Scatta foto", onPress: () => void takePhoto() },
      { text: "Galleria", onPress: () => void pickFromLibrary() },
    ]);
  }

  const weightCard = (
    <Card className="gap-2">
      <Text className="font-inter-semibold text-sm text-foreground">Andamento peso</Text>
      <WeightChart
        points={weight.points}
        current={weight.current}
        delta={weight.delta}
        goalOk={weight.goalOk}
      />
    </Card>
  );

  const calorieCard = (
    <Card className="gap-2">
      <Text className="font-inter-semibold text-sm text-foreground">Calorie giornaliere</Text>
      <CalorieChart average={calories.average} target={calorieTarget} days={calories.days} />
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
        photos={photos.data ?? []}
        readOnly={isReadOnly}
        uploading={uploadPhoto.isPending}
        onAdd={handleAddPhoto}
      />
    </Card>
  );

  const measurementsCard = (
    <Card className="gap-3">
      <Text className="font-inter-semibold text-sm text-foreground">Misurazioni corporee</Text>
      <MeasurementsList diffs={diffs} readOnly={isReadOnly} onAdd={() => setShowMeasureModal(true)} />
    </Card>
  );

  const saveErrorBanner = saveError ? (
    <Card className="gap-1 p-4">
      <Text className="font-inter-semibold text-sm text-destructive">Salvataggio non riuscito</Text>
      <Text className="font-sans text-sm leading-5 text-muted">{saveError}</Text>
    </Card>
  ) : null;

  /** Contenuto sotto l'header: loading, errore o dati. */
  let body: ReactNode;
  if (isLoading) {
    body = (
      <View className="items-center gap-3 py-10">
        <ActivityIndicator color="#F97316" />
        <Text className="font-sans text-sm text-muted">Caricamento dei progressi…</Text>
      </View>
    );
  } else if (isError) {
    body = (
      <Card className="items-center gap-3 p-6">
        <Text className="font-inter-semibold text-base text-foreground">Impossibile caricare i progressi</Text>
        <Text className="text-center font-sans text-sm text-muted">{errorMessage(error)}</Text>
        {!isReadOnly ? (
          <Pressable
            onPress={refetch}
            accessibilityRole="button"
            className="mt-1 flex-row items-center gap-1.5 rounded-xl bg-primary px-5 py-3 active:opacity-80"
          >
            <RefreshCw size={16} color="#0F172A" strokeWidth={2.5} />
            <Text className="font-inter-bold text-sm text-primary-foreground">Riprova</Text>
          </Pressable>
        ) : null}
      </Card>
    );
  } else {
    body = (
      <View className="w-full gap-6">
        {saveErrorBanner}
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
                  <Text className="text-center font-sans text-sm text-muted">
                    Sola lettura su browser — installa la PWA per aggiungere foto e misurazioni
                  </Text>
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
      </View>
    );
  }

  return (
    <Screen>
      <ScrollView
        className="flex-1"
        contentContainerClassName={`w-full gap-6 px-4 py-6 ${isWide ? "mx-auto max-w-5xl px-6" : ""}`}
      >
        {/* Header */}
        <View className="gap-4">
          <Text className="font-inter-bold text-3xl text-foreground">Progressi</Text>
          <PeriodSelector value={period} onChange={setPeriod} />
        </View>

        {body}
      </ScrollView>

      <AddMeasurementModal
        visible={showMeasureModal}
        onClose={() => setShowMeasureModal(false)}
        onSave={(data) => {
          // Il modal si chiude da solo: in caso di errore appare il banner in pagina.
          setSaveError(null);
          addMeasurement.mutate(
            {
              date: toISODate(new Date()),
              weight_kg: data.weightKg,
              waist_cm: data.waistCm,
              hips_cm: data.hipsCm,
              chest_cm: data.chestCm,
              arms_cm: data.armsCm,
            },
            { onError: (err) => setSaveError(errorMessage(err)) },
          );
        }}
      />
    </Screen>
  );
}
