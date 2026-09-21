import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/lib/auth";
import { OnboardingProgressBar } from "@/components/onboarding/OnboardingProgressBar";
import { PersonalDataStep, isPersonalDataValid, type PersonalData } from "@/components/onboarding/PersonalDataStep";
import { GoalStep } from "@/components/onboarding/GoalStep";
import { ActivityStep } from "@/components/onboarding/ActivityStep";
import { DisclaimerStep } from "@/components/onboarding/DisclaimerStep";
import { SummaryStep } from "@/components/onboarding/SummaryStep";
import { calculateTDEE, type ActivityLevel, type Goal, type Gender } from "@/lib/calorieCalculator";

const TOTAL = 5;

export default function OnboardingScreen() {
  const { user, updateUser, completeOnboarding } = useAuth();
  const [step, setStep] = useState(1);

  const [personal, setPersonal] = useState<PersonalData>({
    name: user?.name ?? "",
    age: user?.age ? String(user.age) : "",
    gender: (user?.gender as PersonalData["gender"]) ?? "",
    weight: user?.weightKg ? String(user.weightKg) : "",
    height: user?.heightCm ? String(user.heightCm) : "",
  });
  const [goal, setGoal] = useState<Goal | "">((user?.goal as Goal) ?? "");
  const [activity, setActivity] = useState<ActivityLevel | "">((user?.activityLevel as ActivityLevel) ?? "");
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  const canNext = useMemo(() => {
    if (step === 1) return isPersonalDataValid(personal);
    if (step === 2) return !!goal;
    if (step === 3) return !!activity;
    if (step === 4) return accepted;
    return true;
  }, [step, personal, goal, activity, accepted]);

  const tdeeData = useMemo(() => {
    const w = parseFloat(personal.weight.replace(",", "."));
    const h = parseInt(personal.height, 10);
    const a = parseInt(personal.age, 10);
    return { w, h, a };
  }, [personal]);

  async function handleFinish() {
    if (saving) return;
    setSaving(true);
    const tdee = calculateTDEE(tdeeData.w, tdeeData.h, tdeeData.a, personal.gender as Gender, activity as ActivityLevel, goal as Goal);
    await updateUser({
      name: personal.name.trim() || user?.name || "Utente",
      age: tdeeData.a || null,
      gender: personal.gender || null,
      weightKg: tdeeData.w || null,
      heightCm: tdeeData.h || null,
      goal: goal || null,
      activityLevel: activity || null,
      dailyCalories: tdee,
      acceptedDisclaimer: true,
    });
    await completeOnboarding();
    router.replace("/(tabs)/home");
    setSaving(false);
  }

  return (
    <Screen>
      <View className="flex-1 px-6 pt-4">
        <OnboardingProgressBar current={step} total={TOTAL} />

        <ScrollView className="flex-1" contentContainerClassName="py-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {step === 1 ? <PersonalDataStep value={personal} onChange={setPersonal} /> : null}
          {step === 2 ? <GoalStep value={goal} onChange={setGoal} /> : null}
          {step === 3 ? <ActivityStep value={activity} onChange={setActivity} /> : null}
          {step === 4 ? <DisclaimerStep accepted={accepted} onToggle={setAccepted} /> : null}
          {step === 5 ? (
            <SummaryStep
              weight={tdeeData.w}
              height={tdeeData.h}
              age={tdeeData.a}
              gender={personal.gender}
              activity={activity}
              goal={goal}
            />
          ) : null}
        </ScrollView>

        <View className="flex-row gap-3 pb-8 pt-2">
          {step > 1 ? (
            <Pressable onPress={() => setStep((s) => Math.max(1, s - 1))} className="flex-1 items-center rounded-xl border border-border bg-surface py-3.5 active:opacity-80">
              <Text className="font-inter-semibold text-base text-muted">Indietro</Text>
            </Pressable>
          ) : null}

          {step < 5 ? (
            <Pressable
              onPress={() => setStep((s) => Math.min(TOTAL, s + 1))}
              disabled={!canNext}
              className={`flex-1 items-center rounded-xl py-3.5 active:opacity-80 ${canNext ? "bg-primary" : "bg-primary/40 opacity-60"}`}
            >
              <Text className="font-inter-bold text-base text-primary-foreground">Avanti</Text>
            </Pressable>
          ) : (
            <Pressable onPress={handleFinish} disabled={saving} className={`flex-1 items-center rounded-xl bg-primary py-3.5 active:opacity-80 ${saving ? "opacity-60" : ""}`}>
              <Text className="font-inter-bold text-base text-primary-foreground">{saving ? "Salvataggio…" : "Inizia"}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Screen>
  );
}
