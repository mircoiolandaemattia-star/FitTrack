import type { DayOfWeek, Reminder } from "@/types";

const WEEKDAYS: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const LABELS: Record<DayOfWeek, string> = {
  monday: "Lun",
  tuesday: "Mar",
  wednesday: "Mer",
  thursday: "Gio",
  friday: "Ven",
  saturday: "Sab",
  sunday: "Dom",
};

export function dayLabel(d: DayOfWeek): string {
  return LABELS[d];
}

export function formatReminder(r: Reminder): string {
  const days = r.daysOfWeek.map(dayLabel).join(", ");
  return `${days} ${r.time} - ${r.message}`;
}

let store: Reminder[] = [
  {
    id: "rem-1",
    userId: "mock-user-1",
    type: "palestra",
    daysOfWeek: ["monday", "wednesday", "friday"],
    time: "16:30",
    message: "Vai in palestra",
    isActive: true,
  },
  {
    id: "rem-2",
    userId: "mock-user-1",
    type: "pasto",
    daysOfWeek: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    time: "12:30",
    message: "Pranzo - registra il pasto",
    isActive: true,
  },
];

export function listReminders(): Reminder[] {
  return [...store];
}

export function addReminder(data: Omit<Reminder, "id" | "userId">): Reminder {
  const r: Reminder = { id: `rem-${Date.now()}`, userId: "mock-user-1", ...data };
  store = [...store, r];
  return r;
}

export function toggleReminder(id: string, isActive: boolean): void {
  store = store.map((r) => (r.id === id ? { ...r, isActive } : r));
}

export function deleteReminder(id: string): void {
  store = store.filter((r) => r.id !== id);
}

export { WEEKDAYS };
