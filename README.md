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
scripts/smoke-api.py      smoke test HTTP del backend (36 test)
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
`http://localhost:3000/api`) e manda già il JWT di Supabase Auth in
`Authorization: Bearer` (lo legge da AsyncStorage).

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
│   ├── auth.ts          requireAuth: verifica JWT Supabase → req.user_id
│   ├── wrap.ts          parsing input → handler → output
│   ├── routes.ts        verbo + path + nome handler (zero logica business)
│   ├── app.ts           /health, CORS, mount route, 404, middleware errori
│   └── index.ts         ascolta su process.env.PORT, chiusura SIGTERM
└── lib/prisma.ts        singleton PrismaClient
```

Un handler ha la firma `async (req: ApiRequest) => Promise<ApiResponse>`: si
testa senza HTTP. Gli handler **lanciano** (`HttpError`, `ZodError`, errori
Prisma) e `src/api/errors.ts` è l'unico punto che li traduce in status:

| Sorgente | Status | `error.code` |
| --- | --- | --- |
| token assente/scaduto/non valido | 401 | `UNAUTHENTICATED` |
| zod, input non valido | 400 | `VALIDATION_ERROR` |
| body parser, JSON malformato | 400 | `INVALID_JSON` |
| `HttpError` | assegnato | `BAD_REQUEST` / `NOT_FOUND` / `ROUTE_NOT_FOUND` |
| Prisma P2002 (unicità) | 409 | `UNIQUE_VIOLATION` |
| Prisma P2003 (foreign key) | 422 | `FOREIGN_KEY_VIOLATION` |
| Prisma P2025 (record assente) | 404 | `NOT_FOUND` |
| DB non raggiungibile | 503 | `DATABASE_UNAVAILABLE` |
| tutto il resto | 500 | `INTERNAL_ERROR` (dettagli solo nei log) |

### Autenticazione JWT

Tutte le route `/api` passano per `requireAuth` (`src/server/auth.ts`), che
verifica i token emessi da **Supabase Auth** — login, registrazione e refresh
restano lato Supabase, qui non li reinventiamo:

1. legge `Authorization: Bearer <token>`;
2. verifica la firma HS256 contro `SUPABASE_JWT_SECRET` (solo env, mai
   hardcoded) e la scadenza `exp`, con `algorithms: ["HS256"]` esplicito
   (niente `alg=none` né confusione di algoritmo);
3. estrae l'uuid dal claim `sub` e lo mette in `req.user_id`: gli handler
   leggono l'utente solo da lì (`ApiRequest.user_id`), **mai da query o
   body**, quindi un client non può fingersi un altro utente;
4. token assente o non valido → `401 UNAUTHENTICATED` attraverso lo stesso
   adapter centralizzato (nessun codice di errore duplicato).

Di conseguenza `user_id` non è più un campo di input ed è sparito dalla
validazione zod. Gli endpoint `:id` sono **scoped per proprietà**: una risorsa
di un altro utente e una risorsa inesistente rispondono entrambe `404`, senza
rivelare l'esistenza dell'id (protezione IDOR/BOLA).

Note: la anon key di Supabase non ha il claim `sub` e viene scartata; `/health`
resta senza auth perché lo health check di Render non può mandare token; i
progetti cloud con *Custom Access Token Keys* (asimmetriche) richiedono la
verifica via JWKS e qui il middleware andrebbe esteso.

### Endpoint

| Metodo | Percorso | Note |
| --- | --- | --- |
| GET | `/health` | `200 OK` — health check di Render, unica rota senza auth |
| GET | `/api/workout-plans` | lista propria: nessun parametro, utente dal token |
| POST | `/api/workout-plans` | `201`, `user_id` preso dal token |
| GET / PUT / DELETE | `/api/workout-plans/:id` | DELETE in cascata su days + exercises |
| GET | `/api/workout-days?workout_plan_id=` | lista per piano (obbligatorio) |
| POST | `/api/workout-days` | `201` |
| GET / PUT / DELETE | `/api/workout-days/:id` | DELETE in cascata su exercises |

Tutte le route `/api` richiedono `Authorization: Bearer <JWT Supabase>`.
DELETE risponde `204` senza corpo; gli errori rispondono
`{"error": {"code", "message", "details?"}}`. Ogni input (query, path, body)
è validato con zod.

### Variabili d'ambiente runtime

Solo nomi, i valori si impostano nel dashboard di Render (vedi `.env.example`):

- `DATABASE_URL` — **obbligatoria**, pooler Supabase (porta 6543, `?pgbouncer=true`)
- `SUPABASE_JWT_SECRET` — **obbligatoria**, secret JWT HS256 del progetto
  (Dashboard → Settings → API → JWT Secret) per verificare i token Auth
- `ALLOWED_ORIGIN` — **obbligatoria**, origin abilitate al CORS separate da
  virgola (nessuna apertura a tutte le origini)
- `GEMINI_API_KEY` — in seguito, feature AI (non ancora usata)
- `RESEND_API_KEY` — in seguito, email transazionali (non ancora usata)

`PORT` la fornisce Render (il server usa `process.env.PORT`, nessuna porta
fissa); `DIRECT_URL` serve solo alle migrazioni Prisma, non a runtime.

### Verifica locale

```bash
npx supabase start                # DB locale (una volta)
PORT=3000 npm start               # il client Prisma carica .env da solo
python3 scripts/smoke-api.py      # 36/36 test
```

Lo smoke test **genera i suoi JWT** firmati con `SUPABASE_JWT_SECRET` (da
`.env`): si esercita il percorso reale di verifica, senza bypass dell'auth, e
copre anche token mancanti/malformati/firmati male/scaduti e l'isolamento fra
utenti.

Senza `PORT` il server usa 3000; se mancano `DATABASE_URL`,
`SUPABASE_JWT_SECRET` o `ALLOWED_ORIGIN` (né `.env`) esce con codice 1 ed elenca
le variabili mancanti, così un deploy mal configurato fallisce subito invece di
dare errori a runtime.

## Approfondimenti

- [Documentazione Expo](https://docs.expo.dev)
- [Expo Router](https://docs.expo.dev/router/introduction)
- [NativeWind](https://www.nativewind.dev)