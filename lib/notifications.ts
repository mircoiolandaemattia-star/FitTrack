import { Platform } from "react-native";
import type { Reminder } from "@/types";
import { DAY_TO_INDEX } from "./reminderQueries";
import { getJson, setJson } from "./storage";

/**
 * Notifiche locali per i promemoria (expo-notifications).
 *
 * I promemoria vivono nel backend (`/api/reminders`), ma è il dispositivo a
 * dover avvisare: qui vengono programmate notifiche settimanali, una per ogni
 * giorno scelto, e riallineate a ogni cambiamento della lista.
 *
 * Regole:
 *  - niente su web: la PWA non può programmare notifiche locali;
 *  - niente senza il permesso di sistema: se manca si azzera tutto;
 *  - le operazioni vengono messe in coda: due riallineamenti sovrapposti si
 *    cancellerebbero a vicenda;
 *  - nessun errore arriva in schermata: un problema delle notifiche non deve
 *    rompere il profilo.
 */

/** Preferenza "notifiche attive", persistita sul dispositivo. */
const ENABLED_KEY = "notifications:enabled";

/** Prefisso dei nostri identificativi: il ripristino cancella solo i nostri. */
const ID_PREFIX = "fittrack:reminder:";

/** Canale Android: senza canale non c'è alcun avviso su Android 8+. */
const CHANNEL_ID = "promemoria";

/** Titolo della notifica per tipo di promemoria. */
const TYPE_TITLES: Record<string, string> = {
  workout: "Allenamento",
  meal: "Pasto",
  measurement: "Misurazioni",
  custom: "Promemoria",
};

/**
 * Modulo a import dinamico: su web non esiste nulla di utilizzabile e non si
 * vuole importare codice nativo nel bundle della PWA.
 */
async function notificationsModule(): Promise<typeof import("expo-notifications") | null> {
  if (Platform.OS === "web") return null;
  try {
    return await import("expo-notifications");
  } catch {
    return null;
  }
}

/** Legge la preferenza "notifiche attive": di default sono attivate. */
export async function loadNotificationsEnabled(): Promise<boolean> {
  return (await getJson<boolean>(ENABLED_KEY)) ?? true;
}

/** Salva la preferenza: un errore di storage non deve bloccare il toggle. */
export async function saveNotificationsEnabled(value: boolean): Promise<void> {
  try {
    await setJson(ENABLED_KEY, value);
  } catch {
    // Preferenza persa: resta valida solo finché dura la sessione.
  }
}

/**
 * Handler per le notifiche ricevute con l'app aperta: senza handler il
 * sistema le butta via invece di mostrarle.
 */
export async function configureNotifications(): Promise<void> {
  const N = await notificationsModule();
  if (!N) return;
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Chiede il permesso di sistema; `false` se rifiutato o non disponibile. */
export async function requestNotificationPermission(): Promise<boolean> {
  const N = await notificationsModule();
  if (!N) return false;
  try {
    const current = await N.getPermissionsAsync();
    if (current.status === "granted") return true;
    return (await N.requestPermissionsAsync()).status === "granted";
  } catch {
    return false;
  }
}

/** Stato attuale del permesso; `null` se non interrogabile (es. web). */
export async function getNotificationPermission(): Promise<boolean | null> {
  const N = await notificationsModule();
  if (!N) return null;
  try {
    return (await N.getPermissionsAsync()).status === "granted";
  } catch {
    return null;
  }
}

type PendingNotification = {
  identifier: string;
  /** 1=Domenica ... 7=Sabato (la convenzione usata dai trigger settimanali). */
  weekday: number;
  hour: number;
  minute: number;
  title: string;
  body: string;
};

/** "HH:MM" → orario; un orario malformato viene ignorato, non lanciato. */
function parseTime(time: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/** Una notifica per promemoria attivo × giorno scelto. */
function buildSchedule(reminders: Reminder[]): PendingNotification[] {
  const pending: PendingNotification[] = [];
  for (const reminder of reminders) {
    if (!reminder.isActive) continue;
    const time = parseTime(reminder.time);
    if (!time) continue;
    const title = TYPE_TITLES[reminder.type] ?? TYPE_TITLES.custom;
    const body = reminder.message.trim() || "È il momento del tuo promemoria.";
    for (const day of reminder.daysOfWeek) {
      const index = DAY_TO_INDEX[day];
      pending.push({
        identifier: `${ID_PREFIX}${reminder.id}:${index}`,
        // Indice del backend (lunedì=0) → trigger (domenca=1).
        weekday: ((index + 1) % 7) + 1,
        hour: time.hour,
        minute: time.minute,
        title,
        body,
      });
    }
  }
  return pending;
}

/** Coda: i riallineamenti si eseguono uno alla volta, in ordine. */
let queue: Promise<void> = Promise.resolve();

/**
 * Riallinea le notifiche programmate a quelle dei promemoria dati.
 * Passa `[]` per cancellare tutto (logout, notifiche disattivate).
 */
export function syncReminderNotifications(reminders: Reminder[]): Promise<void> {
  queue = queue.then(() => runSync(reminders), () => runSync(reminders));
  return queue;
}

async function runSync(reminders: Reminder[]): Promise<void> {
  const N = await notificationsModule();
  if (!N) return;

  try {
    // Prima si pulisce, poi si riscrive: così un promemoria cambiato o
    // eliminato non lascia scorie nel sistema.
    const scheduled = await N.getAllScheduledNotificationsAsync();
    for (const request of scheduled) {
      if (request.identifier.startsWith(ID_PREFIX)) {
        await N.cancelScheduledNotificationAsync(request.identifier);
      }
    }

    const permission = await N.getPermissionsAsync();
    if (permission.status !== "granted" || reminders.length === 0) return;

    if (Platform.OS === "android") {
      await N.setNotificationChannelAsync(CHANNEL_ID, {
        name: "Promemoria",
        importance: N.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#F97316",
      });
    }

    for (const item of buildSchedule(reminders)) {
      await N.scheduleNotificationAsync({
        identifier: item.identifier,
        content: { title: item.title, body: item.body, sound: true },
        trigger: {
          type: N.SchedulableTriggerInputTypes.WEEKLY,
          weekday: item.weekday,
          hour: item.hour,
          minute: item.minute,
          channelId: Platform.OS === "android" ? CHANNEL_ID : undefined,
        },
      });
    }
  } catch {
    // Modulo assente o sistema che rifiuta: le notifiche restano ferme.
  }
}
