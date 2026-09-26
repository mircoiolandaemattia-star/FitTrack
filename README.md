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

L'interfaccia segue il linguaggio di sistema dove possibile: su iOS la tab bar è nativa (Liquid Glass), su Android/Web è la stessa barra JS classica (le icone native Material di NativeTabs su Android non funzionano — vedi nota sotto).

| Piattaforma | Tab bar | Icone |
| ----------- | ------- | ----- |
| **iOS 26+** | Liquid Glass (NativeTabs) | SF Symbols |
| **Android** | Barra JS classica (variante `uikit`, stessa del web) | Lucide + etichette |
| **Web** | Tabs JS in basso (tema scuro) | Lucide + etichette |

Tema scuro `#0F172A` con accento arancione energia (`#F97316`) e verde successo (`#22C55E`), font **Inter**.

> **Nota Android (tab bar):** i tab nativi di NativeTabs su Android passano le icone per
> `renderToImageAsync` + `StateListDrawable` di react-native-screens, che non renderizza
> l'icona sullo stato selezionato. Android (e Web) usano quindi la **stessa barra JS
> classica** (variante `uikit` della BottomTabBar di expo-router): icone Lucide +
> etichette, tinta arancione attiva `#F97316` / grigia inattiva `#94A3B8`, barra scura
> `#0F172A` con hairline, safe area gestita dal fork. La variante `material` del fork è
> disponibile solo con `tabBarPosition` `left`/`right` (barra laterale), non in basso.
> Nessun componente `tabBar` custom: il fork lo invoca come render-prop con chiamata di
> funzione diretta → "Invalid hook call" con componenti React (testato anche via wrapper).
> Su iOS resta la tab bar nativa Liquid Glass (SF Symbols, funziona bene).

## Struttura del progetto

```
app/                      (route Expo Router con guard di autenticazione)
├── _layout.tsx           layout radice: font, auth guard, splash
├── index.tsx             redirect verso login/onboarding/tab
├── (auth)/               login.tsx, register.tsx
├── onboarding.tsx        onboarding post-registrazione
└── (tabs)/               tab bar (5 tab) + schermate
    ├── _layout.tsx       iOS: NativeTabs; Android/Web: barra JS classica (uikit)
    ├── home.tsx          Home (dashboard)
    ├── scheda/           Scheda allenamento
    │   ├── index.tsx
    │   └── allenamento/[dayId].tsx  dettaglio esercizi
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
src/                      backend Express (vedi sezione Backend)
prisma/                   schema Prisma + migrazioni (12 tabelle)
scripts/smoke-api.py      smoke test HTTP del backend (27 test)
```

## Flusso di navigazione

`login/register` → `onboarding` (primo accesso) → `(tabs)`.
Il redirect è gestito nel guard di `app/_layout.tsx` in base allo stato di autenticazione persistito in AsyncStorage.

## Script

| Comando          | Descrizione                        |
| ---------------- | ---------------------------------- |
| `npm run build`  | Build backend (install + prisma generate + tsc) |
| `npm start`      | Backend compilato su `process.env.PORT` |
| `npm run start:app` | Dev server Expo (in precedenza `npm start`) |
| `npm run android`| Emulatore/dispositivo Android      |
| `npm run ios`    | Simulatore iOS                     |
| `npm run web`    | Web nel browser                    |
| `npx tsc --noEmit` | Type check                       |
| `npx expo lint`  | ESLint                             |

## Backend

API REST Express pensata per **Render Web Service** (processo persistente, non
serverless): `npm run build` poi `npm start`.

Il client API (`lib/api.ts`) usa `EXPO_PUBLIC_API_URL` (default
`http://localhost:3000/api`); l'autenticazione è ancora mock: sulle route non
c'è ancora il middleware JWT (i handler leggono `user_id` da query/body).

### Architettura a handler puri

```
src/
├── api/                 handler puri, nessun riferimento a Express
│   ├── types.ts         ApiRequest / ApiResponse / Handler
│   ├── errors.ts        adapter centralizzato degli errori
│   ├── validate.ts      parse(): zod → ZodError
│   ├── workoutPlans.ts  CRUD workout_plans
│   └── workoutDays.ts   CRUD workout_days
├── server/              Express: solo wrapper sottili
│   ├── wrap.ts          parsing input → handler → output
│   ├── routes.ts        verbo + path + nome handler (zero logica business)
│   ├── app.ts           /health, mount route, 404, middleware errori
│   └── index.ts         ascolta su process.env.PORT, chiusura SIGTERM
└── lib/prisma.ts        singleton PrismaClient
```

Un handler ha la firma `async (req: ApiRequest) => Promise<ApiResponse>`: si
testa senza HTTP. Gli handler **lanciano** (`HttpError`, `ZodError`, errori
Prisma) e `src/api/errors.ts` è l'unico punto che li traduce in status:

| Sorgente | Status | `error.code` |
| --- | --- | --- |
| zod, input non valido | 400 | `VALIDATION_ERROR` |
| body parser, JSON malformato | 400 | `INVALID_JSON` |
| `HttpError` | assegnato | `BAD_REQUEST` / `NOT_FOUND` / `ROUTE_NOT_FOUND` |
| Prisma P2002 (unicità) | 409 | `UNIQUE_VIOLATION` |
| Prisma P2003 (foreign key) | 422 | `FOREIGN_KEY_VIOLATION` |
| Prisma P2025 (record assente) | 404 | `NOT_FOUND` |
| DB non raggiungibile | 503 | `DATABASE_UNAVAILABLE` |
| tutto il resto | 500 | `INTERNAL_ERROR` (dettagli solo nei log) |

### Endpoint

| Metodo | Percorso | Note |
| --- | --- | --- |
| GET | `/health` | `200 OK` — health check di Render |
| GET | `/api/workout-plans?user_id=` | lista per utente (obbligatorio) |
| POST | `/api/workout-plans` | `201` |
| GET / PUT / DELETE | `/api/workout-plans/:id` | DELETE in cascata su days + exercises |
| GET | `/api/workout-days?workout_plan_id=` | lista per piano (obbligatorio) |
| POST | `/api/workout-days` | `201` |
| GET / PUT / DELETE | `/api/workout-days/:id` | DELETE in cascata su exercises |

DELETE risponde `204` senza corpo; gli errori rispondono
`{"error": {"code", "message", "details?"}}`. Ogni input (query, path, body)
è validato con zod.

### Variabili d'ambiente runtime

Solo nomi, i valori si impostano nel dashboard di Render (vedi `.env.example`):

- `DATABASE_URL` — **obbligatoria**, pooler Supabase (porta 6543, `?pgbouncer=true`)
- `GEMINI_API_KEY` — in seguito, feature AI (non ancora usata)
- `RESEND_API_KEY` — in seguito, email transazionali (non ancora usata)

`PORT` la fornisce Render (il server usa `process.env.PORT`, nessuna porta
fissa); `DIRECT_URL` serve solo alle migrazioni Prisma, non a runtime.

### Verifica locale

```bash
npx supabase start                # DB locale (una volta)
PORT=3000 npm start               # il client Prisma carica .env da solo
python3 scripts/smoke-api.py      # 27/27 test
```

Senza `PORT` il server usa 3000; senza `DATABASE_URL` (né `.env`) esce con
codice 1 e un messaggio esplicito, così un deploy mal configurato fallisce
subito invece di dare errori a runtime.

## Approfondimenti

- [Documentazione Expo](https://docs.expo.dev)
- [Expo Router](https://docs.expo.dev/router/introduction)
- [NativeWind](https://www.nativewind.dev)