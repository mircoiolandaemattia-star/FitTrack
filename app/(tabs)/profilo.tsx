import { useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/home/Card";
import { PersonalDataCard, type PersonalData } from "@/components/profilo/PersonalDataCard";
import { GoalSelector } from "@/components/profilo/GoalSelector";
import { ActivityLevelSelector } from "@/components/profilo/ActivityLevelSelector";
import { SettingsCard } from "@/components/profilo/SettingsCard";
import { ReminderCard } from "@/components/profilo/ReminderCard";
import { AddReminderModal } from "@/components/profilo/AddReminderModal";
import { SubscriptionCard, type SubscriptionState } from "@/components/profilo/SubscriptionCard";
import { useAuth } from "@/lib/auth";
import { useIsStandalone } from "@/lib/useStandalone";
import { type ActivityLevel, type Goal } from "@/lib/calorieCalculator";
import { GOAL_TO_API, ACTIVITY_TO_API, type CreateProfileInput } from "@/lib/profileQueries";
import { isApiError } from "@/lib/api";
import { birthDateFromAge , useProfile, useUpdateProfile } from "@/lib/profileQueries";
import {
  useReminders,
  useCreateReminder,
  useUpdateReminder,
  useDeleteReminder,
  toReminder,
  type Reminder,
} from "@/lib/reminderQueries";

const WIDE_BP = 768;

/** Messaggio d'errore leggibile: quello dell'API o una rete assente. */
function errorMessage(error: unknown): string {
  return isApiError(error) ? error.message : "Connessione al server non riuscita.";
}

/**
 * Profilo: dati personali, obiettivo, attività da GET/PUT /api/users/me
 * (con conferma prima di salvare perché ricalcola il TDEE), promemoria
 * CRUD da /api/reminders, stato abbonamento da users, logout che pulisce
 * anche la cache React Query. Mock rimossi per le parti collegate.
 */
export default function ProfiloScreen() {
  const { width } = useWindowDimensions();
  const isStandalone = useIsStandalone();
  const { user, logout } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isWide = width >= WIDE_BP;
  const isReadOnly = Platform.OS === "web" && !isStandalone;

  const [showAddReminder, setShowAddReminder] = useState(false);
  // Stato legacy: il setter è ancora usato dal pulsante, il valore non è
  // mai letto (nessuna UI lo usa) → hole nell'array destructuring.
  const [, setEditProfileOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Profilo server (target TDEE, subscription, ecc.)
  const profileQuery = useProfile();
  const profile = profileQuery.data;
  const updateProfile = useUpdateProfile();

  // Promemoria reali
  const remindersQuery = useReminders();
  const reminders: Reminder[] = (remindersQuery.data ?? []).map(toReminder);
  const createReminder = useCreateReminder();
  const updateReminder = useUpdateReminder();
  const deleteReminder = useDeleteReminder();

  // Dati personali derivati dal profilo server + auth locale (nome/email)
  const initial = useMemo(
    () => (user?.name?.trim()?.[0] ?? user?.email?.[0] ?? "?").toUpperCase(),
    [user],
  );

  // Stato abbonamento dal server
  const subState: SubscriptionState = useMemo(() => {
    const status = profile?.subscription_status ?? "free";
    if (status === "premium") return "premium";
    if (status === "trial") return "trial";
    return "free";
  }, [profile?.subscription_status]);

  // Goal/activity per i selettori (profilo server)
  const serverGoal = profile?.goal ?? null;
  const serverActivity = profile?.activity_level ?? null;

  function handlePersonalSave(data: PersonalData) {
    const patch: Partial<CreateProfileInput> = {
      name: data.name.trim() || user?.name,
    };
    if (data.age) patch.birth_date = birthDateFromAge(parseInt(data.age, 10));
    if (data.weightKg) patch.weight_kg = parseFloat(data.weightKg.replace(",", "."));
    if (data.heightCm) patch.height_cm = parseInt(data.heightCm, 10);
    if (data.gender && ["male", "female", "other"].includes(data.gender.trim())) {
      patch.gender = data.gender.trim() as "male" | "female" | "other";
    }

    setSaveError(null);
    updateProfile.mutate(patch, {
      onError: (err) => setSaveError(errorMessage(err)),
    });
    setEditProfileOpen(false);
  }

  function handleGoalChange(g: Goal) {
    // Conferma esplicita: ricalcola il TDEE lato server
    Alert.alert(
      "Cambiare obiettivo?",
      "Il fabbisogno calorico verrà ricalcolato. Vuoi continuare?",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Conferma",
          onPress: () => {
            setSaveError(null);
            updateProfile.mutate({ goal: GOAL_TO_API[g] }, { onError: (err) => setSaveError(errorMessage(err)) });
          },
        },
      ],
    );
  }

  function handleActivityChange(a: ActivityLevel) {
    Alert.alert(
      "Cambiare livello attività?",
      "Il fabbisogno calorico verrà ricalcolato. Vuoi continuare?",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Conferma",
          onPress: () => {
            setSaveError(null);
            updateProfile.mutate({ activity_level: ACTIVITY_TO_API[a] }, { onError: (err) => setSaveError(errorMessage(err)) });
          },
        },
      ],
    );
  }

  function handleStartTrial() {
    // La prova è gestita lato server (se c'è logica) oppure resta stub
    // Qui non c'è endpoint dedicato: usiamo updateUser locale per UI
    // ma il backend non ha trial — lo Stato lo gestisce il server via subscription_status
    Alert.alert(
      "Prova gratuita",
      "La gestione delle prove è delegata al backend (non ancora implementata).",
      [{ text: "OK" }],
    );
  }

  function handleConfirm() {
    Alert.alert(
      "Conferma abbonamento",
      "Il pagamento reale non è ancora implementato (stub).",
      [{ text: "OK" }],
    );
  }

  function handleManage() {
    Alert.alert("Abbonamento", "Portale di pagamento non ancora collegato (stub).", [{ text: "OK" }]);
  }

  async function handleLogout() {
    const confirmed = await new Promise<boolean>((resolve) =>
      Alert.alert("Esci", "Vuoi davvero uscire dall'account?", [
        { text: "Annulla", style: "cancel", onPress: () => resolve(false) },
        { text: "Esci", style: "destructive", onPress: () => resolve(true) },
      ]),
    );
    if (!confirmed) return;
    await logout();
    // Pulisci TUTTA la cache React Query dell'utente uscente
    queryClient.clear();
    router.replace("/(auth)/login");
  }

  function handleReminderToggle(id: string, isActive: boolean) {
    updateReminder.mutate({ id, patch: { isActive } }, { onError: (err) => setSaveError(errorMessage(err)) });
  }

  function handleReminderDelete(id: string) {
    Alert.alert("Eliminare promemoria?", "Confermi l'eliminazione?", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Elimina",
        style: "destructive",
        onPress: () => deleteReminder.mutate(id, { onError: (err) => setSaveError(errorMessage(err)) }),
      },
    ]);
  }

  const header = (
    <View className="flex-row items-center gap-4">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-primary">
        <Text className="font-inter-bold text-xl text-primary-foreground">{initial}</Text>
      </View>
      <View className="flex-1">
        <Text className="font-inter-bold text-lg text-foreground" numberOfLines={1}>
          {user?.name}
        </Text>
        <Text className="font-sans text-sm text-muted" numberOfLines={1}>
          {user?.email}
        </Text>
      </View>
      {!isReadOnly ? (
        <Pressable onPress={() => setEditProfileOpen((v) => !v)} className="rounded-full border border-border bg-surface px-4 py-2 active:opacity-80">
          <Text className="font-inter-semibold text-sm text-foreground">Modifica profilo</Text>
        </Pressable>
      ) : null}
    </View>
  );

  // Personali: se c'è profilo server, usa i suoi dati per età/peso/altezza/sesso
  const personalData: PersonalData = useMemo(() => ({
    name: user?.name ?? "",
    age: profile?.birth_date
      ? String(new Date().getFullYear() - new Date(profile.birth_date).getFullYear())
      : "",
    weightKg: profile?.weight_kg != null ? String(profile.weight_kg) : "",
    heightCm: profile?.height_cm != null ? String(profile.height_cm) : "",
    gender: profile?.gender ?? "",
  }), [profile, user]);

  const leftColumn = (
    <View className="gap-4">
      <PersonalDataCard data={personalData} readOnly={isReadOnly} onSave={handlePersonalSave} />
      <GoalSelector
        value={serverGoal}
        weightKg={profile?.weight_kg ?? null}
        heightCm={profile?.height_cm ?? null}
        age={profile?.birth_date ? new Date().getFullYear() - new Date(profile.birth_date).getFullYear() : null}
        gender={profile?.gender ?? null}
        activityLevel={serverActivity}
        readOnly={isReadOnly}
        onChange={handleGoalChange}
      />
      <ActivityLevelSelector
        value={serverActivity}
        goal={serverGoal}
        weightKg={profile?.weight_kg ?? null}
        heightCm={profile?.height_cm ?? null}
        age={profile?.birth_date ? new Date().getFullYear() - new Date(profile.birth_date).getFullYear() : null}
        gender={profile?.gender ?? null}
        readOnly={isReadOnly}
        onChange={handleActivityChange}
      />
    </View>
  );

  const rightColumn = (
    <View className="gap-4">
      <SettingsCard readOnly={isReadOnly} />
      <ReminderCard
        reminders={reminders}
        readOnly={isReadOnly}
        onToggle={handleReminderToggle}
        onDelete={handleReminderDelete}
        onAdd={() => setShowAddReminder(true)}
      />
      <SubscriptionCard
        state={subState}
        trialEndsAt={profile?.subscription_expires_at ?? null}
        nextRenewal={subState === "premium" ? profile?.subscription_expires_at ?? null : null}
        readOnly={isReadOnly}
        onStartTrial={handleStartTrial}
        onConfirm={handleConfirm}
        onManage={handleManage}
      />
      <Pressable onPress={handleLogout} className="flex-row items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 py-3.5 active:opacity-80">
        <LogOut size={16} color="#EF4444" strokeWidth={2.2} />
        <Text className="font-inter-semibold text-sm text-destructive">Logout</Text>
      </Pressable>
      {isReadOnly ? <Text className="text-center font-sans text-xs text-muted">Sola lettura su browser — installa la PWA per modificare</Text> : null}
    </View>
  );

  const saveErrorBanner = saveError ? (
    <Card className="gap-1 p-4">
      <Text className="font-inter-semibold text-sm text-destructive">Operazione non riuscita</Text>
      <Text className="font-sans text-sm leading-5 text-muted">{saveError}</Text>
    </Card>
  ) : null;

  return (
    <Screen>
      <ScrollView
        className="flex-1"
        contentContainerClassName={`w-full gap-6 px-4 py-6 ${isWide ? "mx-auto max-w-5xl px-6" : ""}`}
      >
        <Text className="font-inter-bold text-3xl text-foreground">Profilo</Text>

        <Card className="gap-2">{header}</Card>

        {saveErrorBanner}

        {isWide ? (
          <View className="w-full flex-row items-start gap-6">
            <View className="flex-1">{leftColumn}</View>
            <View className="flex-1">{rightColumn}</View>
          </View>
        ) : (
          <>
            {leftColumn}
            {rightColumn}
          </>
        )}
      </ScrollView>

      <AddReminderModal
        visible={showAddReminder}
        onClose={() => setShowAddReminder(false)}
        onSave={(data) => {
          // type mapping: "palestra"→"workout", "pasto"→"meal"
          const typeMap: Record<string, "workout" | "meal" | "measurement" | "custom"> = {
            palestra: "workout",
            pasto: "meal",
          };
          createReminder.mutate(
            {
              type: typeMap[data.type] ?? "custom",
              daysOfWeek: data.daysOfWeek,
              time: data.time,
              message: data.message,
              isActive: data.isActive,
            },
            { onError: (err) => setSaveError(errorMessage(err)) },
          );
        }}
      />
    </Screen>
  );
}