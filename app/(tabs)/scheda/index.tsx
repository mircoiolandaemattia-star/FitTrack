import { useCallback, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Check, CheckCircle2, Moon, PenLine, Plus, RefreshCw, X } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/home/Card";
import { useIsStandalone } from "@/lib/useStandalone";
import { getDayLabel, getTodayDayOfWeek, WEEKDAYS } from "@/lib/mock-data";
import { isApiError } from "@/lib/api";
import { confirmAction, notify } from "@/lib/feedback";
import type { DayOfWeek, WorkoutDay } from "@/types";
import {
  consumeWorkoutCompletedNotice,
  useDeleteWorkoutDay,
  useUpdateWorkoutPlan,
  useWorkoutPlan,
  useWorkoutPlans,
  useWorkoutSessions,
} from "@/lib/workoutQueries";
import { WorkoutDayCard } from "@/components/scheda/WorkoutDayCard";
import { WorkoutHistoryList } from "@/components/scheda/WorkoutHistoryList";
import { CreateWorkoutModal } from "@/components/scheda/CreateWorkoutModal";
import { EditWorkoutDayModal } from "@/components/scheda/EditWorkoutDayModal";

const WIDE_BREAKPOINT = 768;

/** Messaggio d'errore leggibile: quello dell'API o una rete assente. */
function errorMessage(error: unknown): string {
  return isApiError(error) ? error.message : "Connessione al server non riuscita.";
}

/**
 * Scheda: vista settimanale con card espandibili per giorno, modal di
 * creazione dal bottone "+" e storico delle sessioni. I dati arrivano
 * tutti da React Query (piano con giorni/esercizi annidati + sessioni).
 * Su desktop/web i bottoni "+" e "Inizia" sono nostri (sola lettura) e il
 * layout diventa a due colonne.
 */
export default function SchedaScreen() {
  const { width } = useWindowDimensions();
  const isStandalone = useIsStandalone();
  const isWide = width >= WIDE_BREAKPOINT;
  const isInteractive = !(Platform.OS === "web" && !isStandalone);

  const [modalOpen, setModalOpen] = useState(false);
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  // Modifica della scheda: giorno aperto nel form di modifica, giorno vuoto
  // da riempire (preselezione del weekday) e rinomina del piano.
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [addWeekday, setAddWeekday] = useState<DayOfWeek | null>(null);
  const [renamingPlan, setRenamingPlan] = useState(false);
  const [planNameDraft, setPlanNameDraft] = useState("");

  // Lista piani → piano attivo → dettaglio con giorni/esercizi annidati.
  const plansQuery = useWorkoutPlans();
  const plans = plansQuery.data ?? [];
  const activePlan = plans.find((plan) => plan.isActive) ?? plans[0] ?? null;
  const planQuery = useWorkoutPlan(activePlan?.id);
  const sessionsQuery = useWorkoutSessions();

  // Scritture della modifica (eliminazione giorno, rinomina piano).
  const deleteDay = useDeleteWorkoutDay();
  const renamePlan = useUpdateWorkoutPlan();

  const plan = planQuery.data ?? null;
  const days = plan?.days ?? [];
  const todayKey = getTodayDayOfWeek();
  // Giorno aperto nel form di modifica (null = nessuna modifica in corso).
  const editingDay = days.find((day) => day.id === editingDayId) ?? null;

  // Al ritorno dall'allenamento attivo: mostra il messaggio una volta sola.
  useFocusEffect(
    useCallback(() => {
      if (consumeWorkoutCompletedNotice()) {
        setShowCompleted(true);
        const timer = setTimeout(() => setShowCompleted(false), 6000);
        return () => clearTimeout(timer);
      }
    }, []),
  );

  const isLoading = plansQuery.isLoading || planQuery.isLoading;
  const isError = plansQuery.isError || planQuery.isError;
  const error = plansQuery.error ?? planQuery.error;

  function refetch() {
    if (plansQuery.isError) void plansQuery.refetch();
    else void planQuery.refetch();
  }

  const daysOrdered = WEEKDAYS.map((weekday) => days.find((day) => day.dayOfWeek === weekday));
  const todayId = days.find((day) => day.dayOfWeek === todayKey)?.id ?? null;
  // Se il giorno espanso non esiste più (sostituito dal modal), si apre quello di oggi.
  const resolvedExpanded = days.some((day) => day.id === expandedDayId)
    ? expandedDayId
    : todayId;

  function toggleDay(id: string) {
    setExpandedDayId((previous) => (previous === id ? null : id));
  }

  /** Chiude il modal aprendo il giorno appena salvato. */
  function handleModalDone(dayId: string) {
    setExpandedDayId(dayId);
  }

  /** Apre il form di modifica sul giorno scelto (matita nella card). */
  function openEditDay(dayId: string) {
    setEditingDayId(dayId);
  }

  /** Apre il form di creazione con il weekday già selezionato (card vuota). */
  function openAddOn(weekday: DayOfWeek) {
    setAddWeekday(weekday);
    setModalOpen(true);
  }

  /**
   * Elimina un giorno dopo conferma. Ritorna true se è partita: il form di
   * modifica lo usa per chiudersi solo quando il giorno è davvero via.
   */
  async function handleDeleteDay(day: WorkoutDay): Promise<boolean> {
    const accepted = await confirmAction({
      title: "Elimina giorno",
      message: `Vuoi eliminare “${day.name}” e i suoi ${day.exercises.length} esercizi? Lo storico delle sessioni resta.`,
      confirmLabel: "Elimina",
      destructive: true,
    });
    if (!accepted) return false;
    try {
      await deleteDay.mutateAsync(day.id);
      return true;
    } catch (err) {
      notify("Eliminazione non riuscita", errorMessage(err));
      return false;
    }
  }

  /* ------------------------------ Rinomina piano ---------------------------- */

  function startRenamePlan() {
    setPlanNameDraft(plan?.name ?? "");
    setRenamingPlan(true);
  }

  async function handleRenamePlan(accepted: boolean) {
    if (!accepted || !activePlan || renamePlan.isPending) {
      setRenamingPlan(false);
      return;
    }
    const name = planNameDraft.trim();
    if (!name || name === activePlan.name) {
      setRenamingPlan(false);
      return;
    }
    try {
      await renamePlan.mutateAsync({ planId: activePlan.id, name });
    } catch (err) {
      notify("Rinomina non riuscita", errorMessage(err));
    }
    setRenamingPlan(false);
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
              {isInteractive ? (
                <Pressable
                  onPress={() => openAddOn(weekday)}
                  accessibilityRole="button"
                  accessibilityLabel={`Aggiungi allenamento di ${getDayLabel(weekday)}`}
                  className="flex-row cursor-pointer items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-2 active:opacity-80"
                >
                  <Plus size={15} color="#F97316" strokeWidth={2.6} />
                  <Text className="font-inter-semibold text-xs text-foreground">Aggiungi</Text>
                </Pressable>
              ) : null}
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
            editable={isInteractive}
            onEdit={() => openEditDay(day.id)}
            onDelete={() => void handleDeleteDay(day)}
          />
        );
      })}
    </View>
  );

  const historySection = (
    <View className="gap-4">
      <Text className="font-inter-semibold text-base text-foreground">Storico sessioni</Text>
      {sessionsQuery.isLoading ? (
        <View className="items-center py-4">
          <ActivityIndicator color="#F97316" />
        </View>
      ) : sessionsQuery.isError ? (
        <Card>
          <Text className="font-sans text-sm text-muted">
            {errorMessage(sessionsQuery.error)}
          </Text>
        </Card>
      ) : (
        <WorkoutHistoryList
          sessions={sessionsQuery.data ?? []}
          dayNames={Object.fromEntries(days.map((day) => [day.id, day.name]))}
        />
      )}
    </View>
  );

  /** Contenuto della schermata sotto l'header: loading, errore o dati. */
  let body: ReactNode;
  if (isLoading) {
    body = (
      <View className="items-center gap-3 py-10">
        <ActivityIndicator color="#F97316" />
        <Text className="font-sans text-sm text-muted">Caricamento della scheda…</Text>
      </View>
    );
  } else if (isError) {
    body = (
      <Card className="items-center gap-3 p-6">
        <Text className="font-inter-semibold text-base text-foreground">
          Impossibile caricare la scheda
        </Text>
        <Text className="text-center font-sans text-sm text-muted">{errorMessage(error)}</Text>
        {isInteractive ? (
          <Pressable
            onPress={refetch}
            accessibilityRole="button"
            className="mt-1 flex-row cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-5 py-3 active:opacity-80"
          >
            <RefreshCw size={16} color="#0F172A" strokeWidth={2.5} />
            <Text className="font-inter-bold text-sm text-primary-foreground">Riprova</Text>
          </Pressable>
        ) : null}
      </Card>
    );
  } else if (!activePlan || !plan) {
    body = (
      <Card className="items-center gap-3 p-6">
        <Text className="font-inter-semibold text-base text-foreground">
          Nessun piano di allenamento
        </Text>
        <Text className="text-center font-sans text-sm text-muted">
          Crea il tuo primo giorno di scheda per iniziare ad allenarti.
        </Text>
        {isInteractive ? (
          <Pressable
            onPress={() => setModalOpen(true)}
            accessibilityRole="button"
            className="mt-1 flex-row cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-5 py-3 active:opacity-80"
          >
            <Plus size={16} color="#0F172A" strokeWidth={2.5} />
            <Text className="font-inter-bold text-sm text-primary-foreground">Crea scheda</Text>
          </Pressable>
        ) : null}
      </Card>
    );
  } else {
    body = (
      <View className="w-full gap-4">
        <Text className="font-inter-semibold text-base text-foreground">Piano settimanale</Text>
        {weeklyList}
        {historySection}
      </View>
    );
  }

  const modeLabel = isInteractive
    ? "Piano settimanale e storico delle sessioni"
    : "Sola lettura su browser — installa la PWA per modificare";

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

            {/* Nome del piano: rinomina in linea (nessun modal aggiuntivo) */}
            {renamingPlan ? (
              <View className="mt-1 flex-row items-center gap-2">
                <TextInput
                  value={planNameDraft}
                  onChangeText={setPlanNameDraft}
                  autoFocus
                  selectTextOnFocus
                  accessibilityLabel="Nome del piano"
                  placeholder="Nome del piano"
                  placeholderTextColor="#64748B"
                  onSubmitEditing={() => void handleRenamePlan(true)}
                  returnKeyType="done"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 font-sans text-sm text-foreground"
                />
                <Pressable
                  onPress={() => void handleRenamePlan(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Conferma nome"
                  hitSlop={6}
                  className="h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-primary active:opacity-80"
                >
                  <Check size={18} color="#0F172A" strokeWidth={2.6} />
                </Pressable>
                <Pressable
                  onPress={() => void handleRenamePlan(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Annulla rinomina"
                  hitSlop={6}
                  className="h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-background/60 active:opacity-80"
                >
                  <X size={18} color="#94A3B8" strokeWidth={2.4} />
                </Pressable>
              </View>
            ) : (
              <View className="mt-1 flex-row flex-wrap items-center gap-x-2 gap-y-1">
                {plan && !isLoading && !isError ? (
                  <>
                    <Text className="font-sans text-sm text-foreground">{plan.name}</Text>
                    <Text className="font-sans text-sm text-muted">· {modeLabel}</Text>
                    {isInteractive ? (
                      <Pressable
                        onPress={startRenamePlan}
                        accessibilityRole="button"
                        accessibilityLabel="Rinomina la scheda"
                        hitSlop={6}
                        className="h-7 w-7 cursor-pointer items-center justify-center rounded-md active:opacity-80"
                      >
                        <PenLine size={14} color="#94A3B8" strokeWidth={2.2} />
                      </Pressable>
                    ) : null}
                  </>
                ) : (
                  <Text className="font-sans text-sm text-muted">{modeLabel}</Text>
                )}
              </View>
            )}
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

        {isWide && !isLoading && !isError && activePlan ? (
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
          body
        )}
      </ScrollView>

      {/* Creazione: il key cambia col giorno preselezionato, così il form
          riparte pulito e apre già sul giorno giusto. */}
      <CreateWorkoutModal
        key={addWeekday ?? "default"}
        visible={modalOpen}
        planId={activePlan?.id ?? null}
        initialDayOfWeek={addWeekday}
        onClose={() => {
          setModalOpen(false);
          setAddWeekday(null);
        }}
        onDone={handleModalDone}
      />

      {/* Modifica: montato solo sul giorno scelto, con lo stesso trucco del
          key per inizializzare lo stato dal giorno in ingresso. */}
      {activePlan && editingDay ? (
        <EditWorkoutDayModal
          key={editingDay.id}
          visible
          day={editingDay}
          planId={activePlan.id}
          onClose={() => setEditingDayId(null)}
          onDone={handleModalDone}
          onDelete={() => {
            void handleDeleteDay(editingDay).then((deleted) => {
              if (deleted) setEditingDayId(null);
            });
          }}
        />
      ) : null}
    </Screen>
  );
}
