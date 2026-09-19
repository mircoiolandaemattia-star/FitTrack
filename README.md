# FitTrack 💪

App per il monitoraggio del fitness, costruita con [Expo](https://expo.dev) (SDK 57), [Expo Router](https://docs.expo.dev/router/introduction) e TypeScript.

## Avvio rapido

1. Installa le dipendenze

   ```bash
   npm install
   ```

2. Avvia l'app

   ```bash
   npx expo start
   ```

Nell'output troverai le opzioni per aprire l'app su:

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Emulatore Android](https://docs.expo.dev/workflow/android-studio-emulator/)
- [Simulatore iOS](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go) — sandbox limitata per provare lo sviluppo Expo

## Struttura del progetto

```
├── app.json              → configurazione Expo
├── src/
│   └── app/              → routing basato su file (schermate e layout)
│       ├── _layout.tsx   → layout radice (Stack)
│       └── index.tsx     → schermata principale
├── assets/               → icone e risorse statiche
└── package.json
```

Lo sviluppo parte dalle schermate in `src/app`: ogni file corrisponde a una route. Il codice applicativo (componenti, hook, costanti) va organizzato in `src/`.

## Script disponibili

| Comando            | Descrizione                          |
| ------------------ | ------------------------------------ |
| `npm start`        | Avvia il dev server                  |
| `npm run android`  | Avvia su emulatore/dispositivo       |
| `npm run ios`      | Avvia su simulatore iOS              |
| `npm run web`      | Avvia nel browser                    |
| `npx expo lint`    | Esegue ESLint (configurabile)        |

## Approfondimenti

- [Documentazione Expo](https://docs.expo.dev/) — fondamenti e guide avanzate
- [Tutorial Expo](https://docs.expo.dev/tutorial/introduction/) — tutorial passo-passo