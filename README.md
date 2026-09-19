# FitTrack 💪

App per il monitoraggio del fitness: allenamenti, dieta e progressi.
Costruita con **Expo SDK 57**, **Expo Router**, **NativeWind** (Tailwind per React Native) e **TypeScript**. Gira su **iOS, Android e Web (PWA)**.

## Avvio rapido

```bash
npm install
npx expo start          # QR per Expo Go / emulatore
npx expo start --web    # versione web nel browser
```

## Design nativo per piattaforma

L'interfaccia usa i componenti nativi del sistema, non un look "unico" multipiattaforma:

| Piattaforma | Tab bar | Icone |
| ----------- | ------- | ----- |
| **iOS 26+** | Liquid Glass (NativeTabs) | SF Symbols |
| **Android** | Material 3 (Bottom Nav) | Icone Material |
| **Web** | JS tabs (fallback Radix) | Etichette |

Tema scuro `#0F172A` con accento arancione energia (`#F97316`) e verde successo (`#22C55E`), font **Inter**.

## Struttura del progetto

```
app/                      (route Expo Router con guard di autenticazione)
├── _layout.tsx           layout radice: font, auth guard, splash
├── index.tsx             redirect verso login/onboarding/tab
├── (auth)/               login.tsx, register.tsx
├── onboarding.tsx        onboarding post-registrazione
└── (tabs)/               bottom tab nativo (5 tab) + schermate segnaposto
    ├── _layout.tsx       NativeTabs (Liquid Glass / Material)
    ├── home.tsx          Home
    ├── scheda.tsx        Scheda allenamento
    ├── dieta.tsx         Dieta
    ├── progressi.tsx     Progressi
    └── profilo.tsx       Profilo
components/               componenti riutilizzabili (Screen, PlaceholderScreen)
lib/
  ├── api.ts              client API con JWT automatico e gestione 401
  ├── auth.tsx            contesto autenticazione (mock per ora)
  └── storage.ts          helper AsyncStorage
types/index.ts            modelli dati (User, Workout*, Diet*, ecc.)
design-system/            documentazione design system (MASTER.md)
```

## Flusso di navigazione

`login/register` → `onboarding` (primo accesso) → `(tabs)`.
Il redirect è gestito nel guard di `app/_layout.tsx` in base allo stato di autenticazione persistito in AsyncStorage.

## Script

| Comando          | Descrizione                        |
| ---------------- | ---------------------------------- |
| `npm start`      | Dev server                         |
| `npm run android`| Emulatore/dispositivo Android      |
| `npm run ios`    | Simulatore iOS                     |
| `npm run web`    | Web nel browser                    |
| `npx tsc --noEmit` | Type check                       |
| `npx expo lint`  | ESLint                             |

## Backend

Il client API (`lib/api.ts`) usa `EXPO_PUBLIC_API_URL` (default `http://localhost:3000/api`).
Copia `.env.example` → `.env` per personalizzarla. L'autenticazione è mock fino al backend reale.

## Approfondimenti

- [Documentazione Expo](https://docs.expo.dev)
- [Expo Router](https://docs.expo.dev/router/introduction)
- [NativeWind](https://www.nativewind.dev)