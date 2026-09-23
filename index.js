// Entry point con cattura-errori diagnostica.
// In Release React Native non mostra il red screen: un'eccezione JS non
// gestita fa crashare l'app senza mostrare nulla. Questo handler intercetta
// l'errore e lo mostra in un'Alert, così lo si legge direttamente sul device.
// Per tornare alla situazione normale: rimuovere questo file e ripristinare
// "main": "expo-router/entry" in package.json.
const g = globalThis;

function showError(error) {
  try {
    const { Alert } = require('react-native');
    const msg =
      (error && error.message ? error.message : String(error)) +
      '\n\n' +
      (error && error.stack ? String(error.stack) : '');
    Alert.alert('Errore JS non gestito', msg.slice(0, 3500));
  } catch (e) {
    // niente da fare qui: l'import di react-native è fallito a sua volta
  }
}

try {
  if (g.ErrorUtils && typeof g.ErrorUtils.setGlobalHandler === 'function') {
    g.ErrorUtils.setGlobalHandler(function (error) {
      showError(error);
      try {
        console.error('[catturato]', error);
      } catch (e) {}
      // deliberatamente NON rilanciamo: vogliamo leggere l'errore sullo schermo
    });
  }
} catch (e) {
  // se ErrorUtils non è disponibile si continua come prima
}

require('expo-router/entry');
