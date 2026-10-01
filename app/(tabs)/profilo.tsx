import { useEffect, useMemo, useState } from "react";
import {
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
import { GOAL_TO_API, ACTIVITY_TO_API, goalFromApi, activityFromApi, type CreateProfileInput } from "@/lib/profileQueries";
import { isApiError } from "@/lib/api";
import { confirmAction, notify } from "@/lib/feedback";
import {
  getNotificationPermission,
  loadNotificationsEnabled,
  requestNotificationPermission,
  saveNotificationsEnabled,
  syncReminderNotifications,
} from "@/lib/notifications";
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
 * CRUD da /api/reminders — con le notifiche locali che li riallineano a
 * ogni cambiamento — stato abbonamento da users, logout che pulisce anche
 * la cache React Query. Mock rimossi per le parti collegate.
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

  // Notifiche: preferenza del dispositivo + permesso di sistema. Finchè non
  // sono letti non si tocca nulla di programmato, altrimenti un riavvio
  // cancellerebbe le notifiche già programmate.
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);
  const [notifReady, setNotifReady] = useState(false);
  // Le notifiche partono solo con permesso esplicito: la preferenza da sola
  // non basta (e l'interruttore deve mostrare la realtà, non la speranza).
  const notifActive = notifReady && notifEnabled && notifGranted === true;

  // Profilo server (target TDEE, subscription, ecc.)
  const profileQuery = useProfile();
  const profile = profileQuery.data;
  const updateProfile = useUpdateProfile();

  // Promemoria reali (memo: la referenza deve restare stabile, altrimenti
  // l'effect che riallinea le notifiche partirebbe ad ogni render)
  const remindersQuery = useReminders();
  const reminders: Reminder[] = useMemo(
    () => (remindersQuery.data ?? []).map(toReminder),
    [remindersQuery.data],
  );
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

  // Goal/activity per i selettori: il server parla "lose"/"active", l'app
  // "dimagrire"/"high" → senza la conversione nessuna opzione risultava
  // selezionata (e il TDEE usava delta e fattore di default).
  const serverGoal = goalFromApi(profile?.goal);
  const serverActivity = activityFromApi(profile?.activity_level);

  // Preferenza e permesso: letti una volta all'apertura della schermata.
  useEffect(() => {
    let active = true;
    void Promise.all([loadNotificationsEnabled(), getNotificationPermission()]).then(
      ([enabled, granted]) => {
        if (!active) return;
        setNotifEnabled(enabled);
        setNotifGranted(granted);
        setNotifReady(true);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  // Riallinea le notifiche programmate ai promemoria mostrati: si esegue
  // quando cambiano i promemoria, il permesso o la preferenza.
  useEffect(() => {
    if (!notifReady) return;
    // Con le notifiche accese serve la lista dal server: un profilo aperto
    // offline altrimenti cancellerebbe ciò che è già programmato.
    if (notifActive && remindersQuery.data === undefined) return;
    void syncReminderNotifications(notifActive ? reminders : []);
  }, [notifReady, notifActive, reminders, remindersQuery.data]);

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

  async function handleGoalChange(g: Goal) {
    // Conferma esplicita: ricalcola il TDEE lato server
    const confirmed = await confirmAction({
      title: "Cambiare obiettivo?",
      message: "Il fabbisogno calorico verrà ricalcolato. Vuoi continuare?",
      confirmLabel: "Conferma",
    });
    if (!confirmed) return;
    setSaveError(null);
    updateProfile.mutate({ goal: GOAL_TO_API[g] }, { onError: (err) => setSaveError(errorMessage(err)) });
  }

  async function handleActivityChange(a: ActivityLevel) {
    const confirmed = await confirmAction({
      title: "Cambiare livello attività?",
      message: "Il fabbisogno calorico verrà ricalcolato. Vuoi continuare?",
      confirmLabel: "Conferma",
    });
    if (!confirmed) return;
    setSaveError(null);
    updateProfile.mutate({ activity_level: ACTIVITY_TO_API[a] }, { onError: (err) => setSaveError(errorMessage(err)) });
  }

  /**
   * Nessun sistema di pagamento in questa versione: lo stato dell'abbonamento
   * è il campo `users.subscription_status`, che l'amministratore attiva da
   * Supabase Studio. Le tre azioni spiegano solo come funziona.
   */
  function subscriptionNotice(title: string) {
    const status = profile?.subscription_status ?? "free";
    notify(
      title,
      status === "premium"
        ? "Il tuo account è già premium: tutti i contenuti sono sbloccati. Per modifiche o disdetta contatta il supporto."
        : "In questa versione non c'è un portale di pagamento: l'abbonamento premium viene attivato manualmente dall'amministratore dell'app.",
    );
  }

  function handleStartTrial() {
    subscriptionNotice("Prova gratuita");
  }

  function handleConfirm() {
    subscriptionNotice("Conferma abbonamento");
  }

  function handleManage() {
    subscriptionNotice("Abbonamento");
  }

  async function handleLogout() {
    const confirmed = await confirmAction({
      title: "Esci",
      message: "Vuoi davvero uscire dall'account?",
      confirmLabel: "Esci",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await logout();
    } finally {
      // La cache e la navigazione avvengono anche se la revoca fallisce:
      // l'utente deve uscire in ogni caso.
      void syncReminderNotifications([]);
      queryClient.clear();
      router.replace("/(auth)/login");
    }
  }

  /**
   * Toggle notifiche: accendendo si chiede il permesso di sistema (l'effect
   * qui sopra programma poi i promemoria), spegnendo si cancella tutto.
   */
  async function handleNotifToggle(value: boolean) {
    if (isReadOnly || Platform.OS === "web") return;
    if (!value) {
      await saveNotificationsEnabled(false);
      setNotifEnabled(false);
      return;
    }
    const granted = await requestNotificationPermission();
    setNotifGranted(granted);
    // La preferenza resta attiva anche con il permesso negato: la didascalia
    // deve continuare a dire che manca il permesso, non che le notifiche
    // sono state spente dall'utente.
    await saveNotificationsEnabled(true);
    setNotifEnabled(true);
    if (!granted) {
      notify("Permesso negato", "Abilita le notifiche dalle impostazioni del telefono per ricevere i promemoria.");
    }
  }

  function handleReminderToggle(id: string, isActive: boolean) {
    updateReminder.mutate({ id, patch: { isActive } }, { onError: (err) => setSaveError(errorMessage(err)) });
  }

  async function handleReminderDelete(id: string) {
    const confirmed = await confirmAction({
      title: "Eliminare promemoria?",
      message: "Confermi l'eliminazione?",
      confirmLabel: "Elimina",
      destructive: true,
    });
    if (!confirmed) return;
    deleteReminder.mutate(id, { onError: (err) => setSaveError(errorMessage(err)) });
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
      <SettingsCard
        readOnly={isReadOnly}
        enabled={notifEnabled}
        permission={notifGranted}
        onChange={handleNotifToggle}
      />
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
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
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
          // Prima occasione utile per chiedere il permesso: l'utente ha appena
          // chiesto di essere avvisato. Con le notifiche spente invece non si
          // insiste: è una scelta già presa (e lo dice la didascalia).
          if (notifEnabled && Platform.OS !== "web") {
            void requestNotificationPermission().then(setNotifGranted);
          }
        }}
      />
    </Screen>
  );
}