import { Alert, Platform } from "react-native";

/**
 * Dialog e conferme usati da tutta l'app, in forma cross-platform.
 *
 * Su web `Alert.alert` di react-native-web è un *no-op*
 * (`class Alert { static alert() {} }`): il click non mostrava alcuna
 * finestra e, nelle conferme, la promise restava pendente per sempre —
 * era il motivo per cui nella PWA il tasto Logout "non faceva nulla".
 * Su web si usano quindi `window.alert` / `window.confirm`, presenti
 * anche nei browser mobili; su native resta l'Alert di sistema.
 */

type ConfirmOptions = {
  title: string;
  message: string;
  /** Testo del pulsante di conferma. */
  confirmLabel?: string;
  /** Testo del pulsante di annullamento. */
  cancelLabel?: string;
  /** Pulsante di conferma rosso (azioni irreversibili). */
  destructive?: boolean;
};

/** Messaggio con un solo pulsante OK. */
export function notify(title: string, message: string): void {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && typeof window.alert === "function") {
      window.alert(`${title}\n${message}`);
    }
    return;
  }
  Alert.alert(title, message, [{ text: "OK" }]);
}

/**
 * Conferma a due pulsanti: risolve `true` solo se l'utente accetta.
 *
 * Su web `window.confirm` è bloccante (va bene per queste poche azioni);
 * su native si usa l'Alert, con `onDismiss` per non lasciare la promise
 * appesa quando la finestra viene chiusa senza scegliere.
 */
export function confirmAction({
  title,
  message,
  confirmLabel = "Conferma",
  cancelLabel = "Annulla",
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === "web") {
    const accepted =
      typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm(`${title}\n${message}`)
        : false;
    return Promise.resolve(accepted);
  }
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: "cancel", onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? "destructive" : "default",
          onPress: () => resolve(true),
        },
      ],
      { onDismiss: () => resolve(false) },
    );
  });
}
