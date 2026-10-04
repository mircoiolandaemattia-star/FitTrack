// Entry point con cattura-errori diagnostica (canali multipli).
// In Release React Native non mostra il red screen: un'eccezione non
// gestita fa crashare l'app senza mostrare nulla. Un errore fatale può
// arrivare al nativo su TRE vie diverse, qui intercettate tutte:
//   1) ErrorUtils.setGlobalHandler (errori modulo + JS pipeline C++)
//   2) ExceptionsManager.handleException monkey-patched (React:
//      onUncaughtError/ReactFiberErrorDialog e le chiamate direttissime
//      che saltano ErrorUtils)
//   3) RN$registerExceptionListener + preventDefault (pipeline C++ pura,
//      usata quando l'errore avviene mentre lo JS è ancora in partenza)
// Il primo errore catturato viene mostrato in un'Alert E salvato su
// AsyncStorage, così se l'Alert viene chiusa per sbaglio si rivede al
// prossimo avvio.
// Per tornare alla situazione normale: rimuovere questo file e
// ripristinare "main": "expo-router/entry" in package.json.

const g = globalThis;
const STORE_KEY = "fittrack_diag_fatal_error";
let shown = false;

function formatError(error, extra) {
  const message =
    error && error.message != null
      ? String(error.message)
      : typeof error === "string"
        ? error
        : safeStringify(error);
  const stack = error && error.stack ? String(error.stack) : "";
  return (
    "[" +
    (extra && extra.channel ? extra.channel : "sconosciuto") +
    "]\n" +
    message +
    (stack ? "\n\n" + stack : "") +
    (extra && extra.detail ? "\n\n" + extra.detail : "")
  );
}

function safeStringify(obj) {
  try {
    return JSON.stringify(obj, null, 1).slice(0, 1500);
  } catch (e) {
    return String(obj);
  }
}

function showError(channel, error, detail) {
  if (shown) return; // mostra solo il primo errore
  shown = true;
  const text = formatError(error, { channel, detail });
  // L'errore può arrivare prima che l'app nasconda lo splash: lo nascondiamo
  // noi, altrimenti l'Alert potrebbe restare coperta dalla splash.
  try {
    require("expo-splash-screen").hideAsync();
  } catch (e) {}
  // Persistito così il testo sopravvive a un tap accidentale sull'Alert.
  try {
    require("@react-native-async-storage/async-storage")
      .default.setItem(STORE_KEY, text)
      .catch(() => {});
  } catch (e) {}
  try {
    const { Alert } = require("react-native");
    Alert.alert("Errore JS non gestito", text.slice(0, 3500), [
      { text: "OK", style: "cancel" },
    ]);
  } catch (e) {
    // niente da fare qui: anche react-native ha fallito
  }
  try {
    console.error("[catturato:" + channel + "]", error);
  } catch (e) {}
}

// --- 1) Canale ErrorUtils ---------------------------------------------
// Copre: errori di valutazione dei moduli (Metro applyWithGuard), callback
// asincrone e handler di eventi nativi. Solo fatali: gli errori non fatali
// non crashano e non devono consumare il guard "mostra solo il primo".
try {
  if (g.ErrorUtils && typeof g.ErrorUtils.setGlobalHandler === "function") {
    g.ErrorUtils.setGlobalHandler(function (error, isFatal) {
      if (isFatal) {
        showError("ErrorUtils", error);
        // deliberatamente NON rilanciamo: vogliamo leggere l'errore
        return;
      }
      try {
        console.error("[catturato-nonfatale]", error);
      } catch (e) {}
    });
  }
} catch (e) {}

// --- 2) Canale ExceptionsManager.handleException -----------------------
// È l'oggetto export del modulo: sostituendo la proprietà colpiamo ogni
// chiamata diretta (setUpErrorHandling, ReactFiberErrorDialog,
// onUncaughtError di React), anche se qualcuno avesse rimesso il SUO
// handler su ErrorUtils dopo di noi. I fatali vengono assorbiti.
try {
  const EM = require("react-native/Libraries/Core/ExceptionsManager").default;
  const origHandle = EM.handleException;
  EM.handleException = function (e, isFatal) {
    if (isFatal) {
      showError("handleException", e);
      return; // NON propagare al nativo: niente reportFatal → niente crash
    }
    return origHandle.apply(this, arguments);
  };
} catch (e) {}

// --- 3) Canale C++ puro (pipeline "always available") ------------------
// Se l'errore avviene mentre lo JS è ancora in partenza, C++ gestisce da
// solo e non tocca il JS. Il listener riceve l'errore e, con
// preventDefault, BLOCCA il report nativo fatale.
try {
  if (typeof g.RN$registerExceptionListener === "function") {
    g.RN$registerExceptionListener(function (data) {
      if (data && data.type === "warn") return; // i warn non ci interessano
      const msg = data && (data.message || data.originalMessage);
      const detail =
        data && data.componentStack ? "componentStack: " + data.componentStack : "";
      showError("C++ pipeline", msg != null ? msg : data, detail);
      try {
        if (data && typeof data.preventDefault === "function") {
          data.preventDefault(); // ferma il crash nativo
        }
      } catch (e) {}
    });
  }
} catch (e) {}

// --- 4) Errori sincroni durante la valutazione dell'entry ---------------
try {
  require("expo-router/entry");
} catch (e) {
  showError("valutazione entry", e);
}

// --- 5) Recupero dell'errore salvato in un avvio precedente -------------
// Se l'Alert del punto precedente è stata chiusa senza copiare il testo,
// all'avvio successivo viene ripresentata una volta e poi cancellata.
try {
  const AS = require("@react-native-async-storage/async-storage").default;
  setTimeout(function () {
    AS.getItem(STORE_KEY)
      .then(function (text) {
        if (!text) return;
        return AS.removeItem(STORE_KEY).then(function () {
          const { Alert } = require("react-native");
          Alert.alert("Errore all'avvio precedente", text.slice(0, 3500), [
            { text: "OK", style: "cancel" },
          ]);
        });
      })
      .catch(function () {});
  }, 1500);
} catch (e) {}
