import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "./api";
import type { DayOfWeek, Reminder } from "@/types";

/** Rielesporta `Reminder` per i componenti che ne hanno bisogno. */
export type { Reminder };

/**
 * Promemoria su backend reale (CRUD /api/reminders), stesso pattern di
 * workoutQueries: query list + mutazioni con invalidazione.
 */

/* --------------------------------- Tipi API -------------------------------- */

/** Riga `reminders` (time = "HH:MM", days_of_week = 0..6). */
export interface ApiReminder {
  id: string;
  user_id: string;
  type: "workout" | "meal" | "measurement" | "custom";
  days_of_week: number[];
  time: string;
  message: string | null;
  is_active: boolean;
  created_at: string;
}

/* ------------------------------- Query keys -------------------------------- */

export const reminderKeys = {
  list: ["reminders", "list"] as const,
};

/** Gli errori HTTP 4xx sono risposte, non intoppi: mai in retry. */
function noRetry(failureCount: number, error: unknown): boolean {
  return isApiError(error) ? error.status >= 500 && failureCount < 1 : failureCount < 2;
}

/* --------------------------------- Queries --------------------------------- */

/** Lista promemoria ordinati per orario (time "HH:MM" a due cifre). */
export function useReminders() {
  return useQuery({
    queryKey: reminderKeys.list,
    queryFn: () => api.get<ApiReminder[]>("/reminders"),
    retry: noRetry,
  });
}

/* --------------------------- Mappature DayOfWeek --------------------------- */

/** Giorni della settimana in ordine ISO (lunedì=0), per UI e invio al backend. */
export const WEEKDAYS: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export function dayLabel(d: DayOfWeek): string {
  const LABELS: Record<DayOfWeek, string> = {
    monday: "Lun",
    tuesday: "Mar",
    wednesday: "Mer",
    thursday: "Gio",
    friday: "Ven",
    saturday: "Sab",
    sunday: "Dom",
  };
  return LABELS[d];
}

/** Indice 0..6 → `DayOfWeek` letterale dell'app (lunedì=0). */
const INDEX_TO_DAY: Record<number, DayOfWeek> = {
  0: "monday",
  1: "tuesday",
  2: "wednesday",
  3: "thursday",
  4: "friday",
  5: "saturday",
  6: "sunday",
};

/** `DayOfWeek` letterale → indice 0..6 (per invio al backend). */
const DAY_TO_INDEX: Record<DayOfWeek, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

export function toReminder(row: ApiReminder): Reminder {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    daysOfWeek: row.days_of_week.map((i) => INDEX_TO_DAY[i]),
    time: row.time,
    message: row.message ?? "",
    isActive: row.is_active,
  };
}

/** Etichette brevi per UI (Lun, Mar, Mer...). */
const LABELS: Record<DayOfWeek, string> = {
  monday: "Lun",
  tuesday: "Mar",
  wednesday: "Mer",
  thursday: "Gio",
  friday: "Ven",
  saturday: "Sab",
  sunday: "Dom",
};

export function formatReminder(r: Reminder): string {
  const days = r.daysOfWeek.map((d) => LABELS[d]).join(", ");
  return `${days} ${r.time} - ${r.message}`;
}

/* -------------------------------- Mutations -------------------------------- */

export type CreateReminderInput = {
  type: "workout" | "meal" | "measurement" | "custom";
  daysOfWeek: DayOfWeek[];
  time: string; // "HH:MM"
  message?: string;
  isActive?: boolean;
};

export function useCreateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReminderInput) =>
      api.post<ApiReminder>("/reminders", {
        type: input.type,
        days_of_week: input.daysOfWeek.map((d) => DAY_TO_INDEX[d]),
        time: input.time,
        message: input.message ?? null,
        is_active: input.isActive ?? true,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reminderKeys.list });
    },
  });
}

export type UpdateReminderInput = {
  id: string;
  patch: Partial<Omit<CreateReminderInput, "daysOfWeek">> & {
    daysOfWeek?: DayOfWeek[];
  };
};

export function useUpdateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateReminderInput) =>
      api.put<ApiReminder>(`/reminders/${id}`, {
        ...(patch.type ? { type: patch.type } : {}),
        ...(patch.daysOfWeek ? { days_of_week: patch.daysOfWeek.map((d) => DAY_TO_INDEX[d]) } : {}),
        ...(patch.time ? { time: patch.time } : {}),
        ...(patch.message !== undefined ? { message: patch.message ?? null } : {}),
        ...(patch.isActive !== undefined ? { is_active: patch.isActive } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reminderKeys.list });
    },
  });
}

export function useDeleteReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/reminders/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reminderKeys.list });
    },
  });
}