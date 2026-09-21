import { useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { LogOut, Pencil } from "lucide-react-native";
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
import { calculateTDEE, type ActivityLevel, type Goal } from "@/lib/calorieCalculator";
import { addReminder, deleteReminder, listReminders, toggleReminder } from "@/lib/reminders";

const WIDE_BP = 768;

export default function ProfiloScreen() {
  const { width } = useWindowDimensions();
  const isStandalone = useIsStandalone();
  const { user, updateUser, logout } = useAuth();
  const router = useRouter();
  const isWide = width >= WIDE_BP;
  const isReadOnly = Platform.OS === "web" && !isStandalone;

  const [reminderVersion, setReminderVersion] = useState(0);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false); // header button toggles personal edit

  const reminders = useMemo(() => listReminders(), [reminderVersion]);

  if (!user) {
    return (
      <Screen className="items-center justify-center">
        <Text className="font-sans text-sm text-muted">Utente non trovato</Text>
      </Screen>
    );
  }

  // dati personali derivati da user
  const u = user!;
  const initial = (u.name?.trim()?.[0] ?? u.email?.[0] ?? "?").toUpperCase();
  const personalData: PersonalData = {
    name: u.name ?? "",
    age: u.age != null ? String(u.age) : "",
    weightKg: u.weightKg != null ? String(u.weightKg) : "",
    heightCm: u.heightCm != null ? String(u.heightCm) : "",
    gender: u.gender ?? "",
  };

  function handlePersonalSave(d: PersonalData) {
    const patch: any = {
      name: d.name.trim() || u.name,
      age: d.age ? parseInt(d.age, 10) || null : null,
      weightKg: d.weightKg ? parseFloat(d.weightKg.replace(",", ".")) || null : null,
      heightCm: d.heightCm ? parseInt(d.heightCm, 10) || null : null,
      gender: d.gender.trim() || null,
    };
    // ricalcola fabbisogno se possibile
    const tdee = calculateTDEE(patch.weightKg ?? u.weightKg, patch.heightCm ?? u.heightCm, patch.age ?? u.age, patch.gender ?? u.gender, (u.activityLevel as ActivityLevel) ?? null, (u.goal as Goal) ?? null);
    if (tdee) patch.dailyCalories = tdee;
    updateUser(patch);
  }

  function handleGoalChange(g: Goal) {
    const tdee = calculateTDEE(u.weightKg ?? 0, u.heightCm ?? 0, u.age ?? 0, u.gender, u.activityLevel as ActivityLevel, g);
    updateUser({ goal: g, dailyCalories: tdee ?? u.dailyCalories });
  }

  function handleActivityChange(a: ActivityLevel) {
    const tdee = calculateTDEE(u.weightKg ?? 0, u.heightCm ?? 0, u.age ?? 0, u.gender, a, u.goal as Goal);
    updateUser({ activityLevel: a, dailyCalories: tdee ?? u.dailyCalories });
  }

  // subscription state
  let subState: SubscriptionState = "free";
  if (u.isPremium && !u.isTrial) subState = "premium";
  else if (u.isTrial) subState = "trial";

  function handleStartTrial() {
    const ends = new Date();
    ends.setDate(ends.getDate() + 30);
    updateUser({ isTrial: true, isPremium: false, trialEndsAt: ends.toISOString() });
  }
  function handleConfirm() {
    const renewal = new Date();
    renewal.setFullYear(renewal.getFullYear() + 1);
    updateUser({ isTrial: false, isPremium: true, trialEndsAt: null });
  }
  function handleManage() {
    Alert.alert("Abbonamento", "Gestione abbonamento (mock): qui si aprirebbe il portale di pagamento.");
  }

  function handleLogout() {
    Alert.alert("Esci", "Vuoi davvero uscire dall'account?", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Esci",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
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
          {u.name}
        </Text>
        <Text className="font-sans text-sm text-muted" numberOfLines={1}>
          {u.email}
        </Text>
      </View>
      {!isReadOnly ? (
        <Pressable onPress={() => setEditProfileOpen((v) => !v)} className="rounded-full border border-border bg-surface px-4 py-2 active:opacity-80">
          <Text className="font-inter-semibold text-sm text-foreground">Modifica profilo</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const leftColumn = (
    <View className="gap-4">
      <PersonalDataCard data={personalData} readOnly={isReadOnly} onSave={handlePersonalSave} />
      <GoalSelector
        value={u.goal}
        weightKg={u.weightKg}
        heightCm={u.heightCm}
        age={u.age}
        gender={u.gender}
        activityLevel={u.activityLevel as ActivityLevel}
        readOnly={isReadOnly}
        onChange={handleGoalChange}
      />
      <ActivityLevelSelector
        value={u.activityLevel as ActivityLevel}
        goal={u.goal as Goal}
        weightKg={u.weightKg}
        heightCm={u.heightCm}
        age={u.age}
        gender={u.gender}
        readOnly={isReadOnly}
        onChange={handleActivityChange}
      />
    </View>
  );

  const rightColumn = (
    <View className="gap-4">
      <SettingsCard readOnly={isReadOnly} />
      <ReminderCard
        reminders={reminders as any}
        readOnly={isReadOnly}
        onToggle={(id, v) => {
          toggleReminder(id, v);
          setReminderVersion((x) => x + 1);
        }}
        onDelete={(id) => {
          deleteReminder(id);
          setReminderVersion((x) => x + 1);
        }}
        onAdd={() => setShowAddReminder(true)}
      />
      <SubscriptionCard
        state={subState}
        trialEndsAt={u.trialEndsAt}
        nextRenewal={subState === "premium" ? new Date(Date.now() + 30 * 86400000).toISOString() : null}
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

  return (
    <Screen>
      <ScrollView className="flex-1" contentContainerClassName={`w-full gap-6 px-4 py-6 ${isWide ? "mx-auto max-w-5xl px-6" : ""}`}>
        <Text className="font-inter-bold text-3xl text-foreground">Profilo</Text>

        <Card className="gap-2">{header}</Card>

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
          addReminder(data as any);
          setReminderVersion((x) => x + 1);
        }}
      />
    </Screen>
  );
}
