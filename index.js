// Entry point con cattura-errori diagnostica (v2 — canali multipli).
// In Release React Native non mostra il red screen: un'eccezione non
// gestita fa crashare l'app senza mostrare nulla. Un errore fatale può
// arrivare al nativo su TRE vie diverse, qui intercettate tutte:
//   1) ErrorUtils.setGlobalHandler (errori modulo + JS pipeline C++)
//   2) ExceptionsManager.handleException monkey-patched (LogBox, React,
//      promise tracker: chiamate direttissime che saltano ErrorUtils)
//   3) RN$registerExceptionListener + preventDefault (pipeline C++ pura,
//      usata quando l'errore avviene mentre lo JS è ancora in partenza)
// Per tornare alla situazione normale: rimuovere questo file e
// ripristinare "main": "expo-router/entry" in package.json.

const g = globalThis;
let shown = false;

function showError(channel, error, extra) {
  if (shown) return; // mostra solo il primo errore
  shown = true;
  // L'errore può arrivare prima che l'app nasconda lo splash: lo nascondiamo
  // noi, altrimenti l'Alert potrebbe restare coperta dalla splash.
  try {
    require('expo-splash-screen').hideAsync();
  } catch (e) {}
  try {
    const { Alert } = require('react-native');
    const msg =
      '[' + channel + ']\n' +
      (error && error.message != null
        ? String(error.message)
        : typeof error === 'string'
          ? error
          : safeStringify(error)) +
      (error && error.stack ? '\n\n' + String(error.stack) : '') +
      (extra ? '\n\n' + extra : '');
    Alert.alert('Errore JS non gestito', msg.slice(0, 3500));
  } catch (e) {
    // niente da fare qui: anche react-native ha fallito
  }
  try {
    console.error('[catturato:' + channel + ']', error);
  } catch (e) {}
}

function safeStringify(obj) {
  try {
    return JSON.stringify(obj, null, 1).slice(0, 1500);
  } catch (e) {
    return String(obj);
  }
}

// --- 1) Canale ErrorUtils ---------------------------------------------
// Copre: errori di valutazione dei moduli (Metro applyWithGuard) e il
// "JS pipeline" C++ → handleJSError → reportFatalError. Solo fatali:
// gli errori non fatali (console.error, rifiuti promise) non crashano e
// non devono consumare il guard "mostra solo il primo".
try {
  if (g.ErrorUtils && typeof g.ErrorUtils.setGlobalHandler === 'function') {
    g.ErrorUtils.setGlobalHandler(function (error, isFatal) {
      if (isFatal) {
        showError('ErrorUtils', error);
        // deliberatamente NON rilanciamo: vogliamo leggere l'errore
        return;
      }
      // non fatale: logga e basta
      try {
        console.error('[catturato-nonfatale]', error);
      } catch (e) {}
    });
  }
} catch (e) {}

// --- 2) Canale ExceptionsManager.handleException -----------------------
// È l'oggetto export del modulo: sostituendo la proprietà colpiamo ogni
// chiamata diretta (setUpErrorHandling, LogBox fatal, ReactFiberErrorDialog,
// promiseRejectionTracking), anche se qualcuno avesse rimesso il SUO
// handler su ErrorUtils dopo di noi. I fatali vengono qui assorbiti.
try {
  const EM = require('react-native/Libraries/Core/ExceptionsManager').default;
  const origHandle = EM.handleException;
  EM.handleException = function (e, isFatal) {
    if (isFatal) {
      showError('handleException', e);
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
  if (typeof g.RN$registerExceptionListener === 'function') {
    g.RN$registerExceptionListener(function (data) {
      if (data && data.type === 'warn') return; // i warn non ci interessano
      const msg = data && (data.message || data.originalMessage);
      const stack =
        data && data.componentStack ? 'componentStack: ' + data.componentStack : '';
      showError('C++ pipeline', msg != null ? msg : data, stack);
      try {
        if (data && typeof data.preventDefault === 'function') {
          data.preventDefault(); // ferma il crash nativo
        }
      } catch (e) {}
    });
  }
} catch (e) {}

// --- 4) Errori sincroni durante la valutazione dell'entry ---------------
try {
  require('expo-router/entry');
} catch (e) {
  showError('valutazione entry', e);
}
