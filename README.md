# FitTrack 💪

App per il monitoraggio del fitness: allenamenti, dieta e progressi.
Costruita con **Expo SDK 57**, **Expo Router**, **NativeWind** (Tailwind per React Native) e **TypeScript**. Gira su **iOS, Android e Web (PWA)**.

## Avvio rapido

```bash
npm install
cp .env.example .env    # env Expo (EXPO_PUBLIC_API_URL, SUPABASE_*) già pronte per il locale
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
  ├── api.ts              client API centralizzata: fetch, Bearer da AsyncStorage, ApiError tipizzata
  ├── auth.tsx            contesto autenticazione (Supabase Auth: login/registro/logout reali)
  ├── supabase.ts         client Supabase (sessioni in AsyncStorage, guard SSR per il web)
  ├── storage.ts          helper AsyncStorage
  ├── profileQueries.ts   React Query: /users/me + creazione profilo (onboarding)
  └── workoutQueries.ts   React Query: piani, dettaglio annidato, sessioni
types/index.ts            modelli dati (User, Workout*, Diet*, ecc.)
design-system/            documentazione design system (MASTER.md)
src/                      backend Express (vedi sezione Backend)
prisma/                   schema Prisma + migrazioni (12 tabelle)
scripts/smoke-api.py      smoke test HTTP del backend (221 test)
scripts/e2e-client-flow.py flusso client end-to-end: signup → 404 → onboarding → scheda → sessione
```

## Flusso di navigazione

`login/register` → `onboarding` (primo accesso) → `(tabs)`.
Il guard di `app/_layout.tsx` aspetta `GET /api/users/me`: `404` (nessun
profilo) → `onboarding`, `200` → `(tabs)`; il token Supabase resta persistito
in AsyncStorage. Le schermate usano React Query (`QueryClientProvider` in
`app/_layout.tsx`) invece di caricamenti/errori manuali.

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
│   ├── validate.ts      parse(): zod → ZodError + schema data/range condivisi
│   ├── users.ts         profilo: onboarding (POST) + /me (GET, PUT)
│   ├── workoutPlans.ts  CRUD workout_plans
│   ├── workoutDays.ts   CRUD workout_days
│   ├── exercises.ts     CRUD exercises (sotto workout_days)
│   ├── workoutSessions.ts  CRUD workout_sessions (performed_data in Json)
│   ├── dietPlans.ts     CRUD diet_plans
│   ├── meals.ts         CRUD meals (filtro data obbligatorio)
│   ├── foodItems.ts     CRUD food_items (sotto meals)
│   ├── bodyMeasurements.ts CRUD body_measurements (almeno un campo)
│   ├── progressPhotos.ts   lista + POST + DELETE (nessun PUT)
│   ├── reminders.ts     CRUD reminders (time HH:MM, days 0-6)
│   ├── aiUsageLog.ts    POST log + GET conteggio di oggi
│   └── lib/tdee.ts      formula TDEE: unica, usata da POST e PUT /users
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
| `HttpError` | assegnato | `BAD_REQUEST` / `NOT_FOUND` / `ROUTE_NOT_FOUND` / `CONFLICT` / `EMAIL_MISSING` |
| Prisma P2002 (unicità) | 409 | `UNIQUE_VIOLATION` |
| Prisma P2003 (foreign key) | 422 | `FOREIGN_KEY_VIOLATION` |
| Prisma P2025 (record assente) | 404 | `NOT_FOUND` |
| DB non raggiungibile | 503 | `DATABASE_UNAVAILABLE` |
| tutto il resto | 500 | `INTERNAL_ERROR` (dettagli solo nei log) |

### Autenticazione JWT

Tutte le route `/api` passano per `requireAuth` (`src/server/auth.ts`), che
verifica i token emessi da **Supabase Auth** — login, registrazione e refresh
restano lato Supabase, qui non li reinventiamo:

1. legge `Authorization: Bearer <token>` e ne decodifica l'header **senza
   fidarsi** per scegliere la verifica;
2. **HS256** → confronto con `SUPABASE_JWT_SECRET` (solo env, mai hardcoded);
   **ES256** → la firma asimmetrica con cui Supabase Auth emette i token
   utente moderni, verificata con la chiave pubblica presa dal JWKS di
   `SUPABASE_JWKS_URL` (cache 10 minuti, un solo fetch alla volta, refresh su
   `kid` ignoto per la rotazione delle chiavi). In entrambi i casi
   `algorithms` è esplicito (niente `alg=none` né confusione di algoritmo),
   ogni altro algoritmo viene scartato, e vale la scadenza `exp`;
3. estrae l'uuid dal claim `sub` e lo mette in `req.user_id`: gli handler
   leggono l'utente solo da lì (`ApiRequest.user_id`), **mai da query o
   body**, quindi un client non può fingersi un altro utente. Estrae anche
   il claim `email` (opzionale: non tutti i token lo contengono) in
   `req.email`, usato da `users.email` — anche quello mai dal body;
4. token assente o non valido → `401 UNAUTHENTICATED` attraverso lo stesso
   adapter centralizzato (nessun codice di errore duplicato).

Di conseguenza `user_id` non è più un campo di input ed è sparito dalla
validazione zod. Gli endpoint `:id` sono **scoped per proprietà**: una risorsa
di un altro utente e una risorsa inesistente rispondono entrambe `404`, senza
rivelare l'esistenza dell'id (protezione IDOR/BOLA). La proprietà è **diretta**
quando la riga ha `user_id` ed **a cascata** quando no (esercizio → giorno →
piano, alimento → pasto): in entrambi i casi mai `403`, solo `404`. Anche i
genitori passati in query o body (es. `workout_day_id`, `meal_id`) vengono
verificati prima di scrivere: altrui → `404`, inesistente → `422` (P2003).

Note: la anon key di Supabase non ha il claim `sub` e viene scartata; `/health`
resta senza auth perché lo health check di Render non può mandare token. Il
percorso JWKS copre anche i progetti cloud con *Custom Access Token Keys*
(firma asimmetrica): basta puntare `SUPABASE_JWKS_URL` a
`https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`.

### Endpoint

| Metodo | Percorso | Note |
| --- | --- | --- |
| GET | `/health` | `200 OK` — health check di Render, unica rota senza auth |
| POST | `/api/users` | `201` onboarding (una tantum, poi `409 CONFLICT`): calcola i target TDEE; `id`/`email` dal token |
| GET / PUT | `/api/users/me` | solo il profilo proprio (nessun `:id`): `404` se l'onboarding non è fatto; PUT ricalcola il TDEE se cambiano i campi della formula |
| GET | `/api/workout-plans` | lista propria: nessun parametro, utente dal token |
| POST | `/api/workout-plans` | `201`, `user_id` preso dal token |
| GET / PUT / DELETE | `/api/workout-plans/:id` | GET annidato: giorni (per `day_order`) con esercizi (per `order_index`); DELETE in cascata su days + exercises |
| GET | `/api/workout-days?workout_plan_id=` | lista per piano (obbligatorio) |
| POST | `/api/workout-days` | `201` |
| GET / PUT / DELETE | `/api/workout-days/:id` | DELETE in cascata su exercises |
| GET | `/api/exercises?workout_day_id=` | lista per giorno (obbligatorio), a cascata sul piano |
| POST | `/api/exercises` | `201` |
| GET / PUT / DELETE | `/api/exercises/:id` | proprietà a cascata giorno → piano |
| GET | `/api/workout-sessions?workout_plan_id=` | lista propria, filtro opzionale |
| POST | `/api/workout-sessions` | `201`, `started_at` obbligatorio, `performed_data` Json validato |
| GET / PUT / DELETE | `/api/workout-sessions/:id` | DELETE: i riferimenti a piano/giorno vanno in SetNull |
| GET / POST | `/api/diet-plans` | come `workout-plans` (`source`, `is_active`, macro opzionali) |
| GET / PUT / DELETE | `/api/diet-plans/:id` | DELETE: `meals.diet_plan_id` in SetNull |
| GET | `/api/meals?date=` oppure `?from=&to=` | filtro **obbligatorio** (giorno o intervallo) |
| POST | `/api/meals` | `201`, `diet_plan_id` opzionale |
| GET / PUT / DELETE | `/api/meals/:id` | DELETE in cascata su food_items |
| GET | `/api/food-items?meal_id=` | lista per pasto (obbligatorio), a cascata sull'utente |
| POST | `/api/food-items` | `201`, `source` in `barcode\|photo\|manual\|upload` |
| GET / PUT / DELETE | `/api/food-items/:id` | proprietà a cascata pasto → utente |
| GET | `/api/body-measurements?from=&to=` | range opzionale; POST richiede almeno un campo numerico |
| POST / GET / PUT / DELETE | `/api/body-measurements[/:id]` | `201` + CRUD con scoping diretto |
| GET / POST | `/api/progress-photos?from=&to=` | range opzionale; `photo_url` obbligatorio |
| DELETE | `/api/progress-photos/:id` | **nessun** GET/PUT by `:id` (rotte assenti → `404 ROUTE_NOT_FOUND`) |
| GET / POST | `/api/reminders` | `time` in formato `HH:MM`, `days_of_week` interi 0–6 |
| GET / PUT / DELETE | `/api/reminders/:id` | CRUD con scoping diretto |
| POST | `/api/ai-usage-log` | log in append (feature enum), nessuna modifica/cancellazione |
| GET | `/api/ai-usage-log/today?feature=` | usi di oggi di `req.user_id` → `{feature, count}` (limite piano free) |

Tutte le route `/api` richiedono `Authorization: Bearer <JWT Supabase>`.
DELETE risponde `204` senza corpo; gli errori rispondono
`{"error": {"code", "message", "details?"}}`. Ogni input (query, path, body)
è validato con zod.

### Variabili d'ambiente runtime

Solo nomi, i valori si impostano nel dashboard di Render (vedi `.env.example`):

- `DATABASE_URL` — **obbligatoria**, pooler Supabase (porta 6543, `?pgbouncer=true`)
- `SUPABASE_JWT_SECRET` — **obbligatoria**, secret JWT HS256 del progetto
  (Dashboard → Settings → API → JWT Secret) per le chiavi simmetriche
- `SUPABASE_JWKS_URL` — **obbligatoria**, JWKS del progetto
  (`<url>/auth/v1/.well-known/jwks.json`) per verificare i token utente
  **ES256** emessi da Supabase Auth (quelli che manda l'app)
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
python3 scripts/smoke-api.py      # 221/221 test
python3 scripts/e2e-client-flow.py # 15/15 flusso client (richiede Supabase locale)
```

Lo smoke test **genera i suoi JWT** firmati con `SUPABASE_JWT_SECRET` (da
`.env`): si esercita il percorso reale di verifica, senza bypass dell'auth, e
copre anche token mancanti/malformati/firmati male/scaduti, `alg=none`, un
token **ES256 reale** preso da Supabase Auth e verificato via JWKS, e
l'isolamento fra utenti. Lo script `e2e-client-flow.py` replica invece il
flusso completo del client: signup → `404 /users/me` → onboarding → piano,
giorno ed esercizi annidati → sessione → preflight CORS.

Senza `PORT` il server usa 3000; se mancano `DATABASE_URL`,
`SUPABASE_JWT_SECRET`, `SUPABASE_JWKS_URL` o `ALLOWED_ORIGIN` (né `.env`)
esce con codice 1 ed elenca le variabili mancanti, così un deploy mal
configurato fallisce subito invece di dare errori a runtime.

## Approfondimenti

- [Documentazione Expo](https://docs.expo.dev)
- [Expo Router](https://docs.expo.dev/router/introduction)
- [NativeWind](https://www.nativewind.dev)