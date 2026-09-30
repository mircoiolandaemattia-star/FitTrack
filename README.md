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
  ├── aiQueries.ts        React Query: /ai/meal-photo, workout-generate, diet-generate, file-read
  ├── fileReader.ts       documento scelto → base64 + MIME per /ai/file-read (web e native)
  ├── foodLookup.ts       React Query: /food-items/lookup (barcode via Open Food Facts)
  ├── progressQueries.ts  React Query: misurazioni, foto (upload su Storage) e serie
  └── workoutQueries.ts   React Query: piani, dettaglio annidato, sessioni
types/index.ts            modelli dati (User, Workout*, Diet*, ecc.)
design-system/            documentazione design system (MASTER.md)
src/                      backend Express (vedi sezione Backend)
prisma/                   schema Prisma + migrazioni (12 tabelle)
scripts/smoke-api.py      smoke test HTTP del backend (221 test)
scripts/e2e-client-flow.py flusso client end-to-end: signup → 404 → onboarding → scheda → sessione
scripts/ai-endpoints.test.mjs test /api/ai/* con Gemini mock (46 test)
scripts/food-lookup.test.mjs test /food-items/lookup con Open Food Facts mock (16 test)
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
│   ├── aiMealPhoto.ts   foto pasto → stime (free 2/giorno, premium illimitato)
│   ├── aiWorkoutGenerate.ts scheda AI → workout_plans annidati (premium)
│   ├── aiDietGenerate.ts dieta AI → diet_plans annidati (premium)
│   ├── aiFileRead.ts    scheda/dieta da foto o PDF → bozza (premium, non salva)
│   ├── aiUsageLog.ts    POST log + GET conteggio di oggi
│   ├── lib/gemini.ts    wrapper unico Gemini: timeout, errori, parsing JSON
│   ├── lib/aiAccess.ts  abbonamento letto a ogni richiesta, quota, log usi
│   ├── lib/aiSchemas.ts forma delle risposte AI = tabelle di destinazione
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
| body parser, corpo oltre il limite | 413 | `PAYLOAD_TOO_LARGE` |
| quota free esaurita (foto pasto) | 403 | `DAILY_LIMIT_REACHED` |
| funzione premium con piano free | 403 | `PREMIUM_REQUIRED` |
| Gemini: chiave assente | 503 | `GEMINI_NOT_CONFIGURED` |
| Gemini: timeout / rate limit | 504 / 429 | `GEMINI_TIMEOUT` / `GEMINI_RATE_LIMITED` |
| Gemini: errore, rete, risposta malformata | 502 | `GEMINI_ERROR` / `GEMINI_UNAVAILABLE` / `GEMINI_INVALID_RESPONSE` / `GEMINI_BLOCKED` / `GEMINI_AUTH_ERROR` |
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
| POST | `/api/food-items` | `201`, `source` in `barcode\|photo\|manual\|upload\|ai` |
| GET | `/api/food-items/lookup?barcode=` | proxy **Open Food Facts**: prodotto per codice a barre con valori **per 100 g** (`404 PRODUCT_NOT_FOUND`, `502 FOOD_FACTS_UNAVAILABLE`, cache 24h); registrata prima di `/food-items/:id` |
| GET / PUT / DELETE | `/api/food-items/:id` | proprietà a cascata pasto → utente |
| GET | `/api/body-measurements?from=&to=` | range opzionale; POST richiede almeno un campo numerico |
| POST / GET / PUT / DELETE | `/api/body-measurements[/:id]` | `201` + CRUD con scoping diretto |
| GET / POST | `/api/progress-photos?from=&to=` | range opzionale; `photo_url` obbligatorio |
| DELETE | `/api/progress-photos/:id` | **nessun** GET/PUT by `:id` (rotte assenti → `404 ROUTE_NOT_FOUND`) |
| GET / POST | `/api/reminders` | `time` in formato `HH:MM`, `days_of_week` interi 0–6 |
| GET / PUT / DELETE | `/api/reminders/:id` | CRUD con scoping diretto |
| POST | `/api/ai-usage-log` | log in append (feature enum), nessuna modifica/cancellazione |
| GET | `/api/ai-usage-log/today?feature=` | usi di oggi di `req.user_id` → `{feature, count}` (limite piano free) |
| POST | `/api/ai/meal-photo` | foto base64 + testo → `{items, notes, remaining_today}`; free 2/giorno, premium illimitato |
| POST | `/api/ai/workout-generate` | obiettivo/giorni/attrezzatura → `workout_plans` (`source: "ai"`) con giorni + esercizi annidati — **premium** |
| POST | `/api/ai/diet-generate` | obiettivo/allergie/pasti → `diet_plans` (`source: "ai"`) con pasti + alimenti annidati — **premium** |
| POST | `/api/ai/file-read` | foto o PDF di scheda/dieta → bozza strutturata **senza salvare** — **premium** |

Tutte le route `/api` richiedono `Authorization: Bearer <JWT Supabase>`.
DELETE risponde `204` senza corpo; gli errori rispondono
`{"error": {"code", "message", "details?"}}`. Ogni input (query, path, body)
è validato con zod.

### Funzioni AI (Google Gemini)

Quattro endpoint sotto `/api/ai/`, tutti le chiamate al modello passano da
**`src/api/lib/gemini.ts`** (timeout, traduzione degli errori, parsing e
validazione JSON in un unico posto). La `GEMINI_API_KEY` sta **solo** nel
backend: mai in una variabile `EXPO_PUBLIC_*`, che finirebbe nel bundle del
client. Senza chiave gli endpoint rispondono `503 GEMINI_NOT_CONFIGURED` e
il resto dell'app continua a funzionare.

Poiché il free tier di Google dà spesso `503 "high demand"`, ritira i modelli
vecchi (`404`) e applica la quota **per modello** (`429`, es. 20 richieste/giorno
su `gemini-3.8-flash`), il wrapper prova una **catena di modelli**: su `503`
ritenta lo stesso modello (`GEMINI_503_RETRIES`, default 1, con attesa
`GEMINI_RETRY_DELAY_MS` crescente), su `404`, `429` o 503 esauriti passa al
fallback (`GEMINI_FALLBACK_MODELS`, default `gemini-3.5-flash-lite`, vuoto =
nessun fallback), che ha un budget proprio. Tutti i tentativi stanno dentro
un unico budget `GEMINI_TIMEOUT_MS` (default 45s). `400`, timeout e errori di
rete non cambiano modello: non dipendono dal singolo modello e ritentare
aumenterebbe solo la latenza.

Il gating legge `users.subscription_status` **ad ogni richiesta** dalla
tabella (niente valori cacheati lato client; il flag si cambia a mano da
Supabase Studio, non c'è un sistema di pagamento):

- `photo_meal` — free e premium; free con **limite 2 al giorno**, verificato
  su `ai_usage_log` *prima* di chiamare Gemini, e `ai_usage_log` scritto
  **solo dopo** una risposta valida: una chiamata fallita non consuma quota;
- `workout_generation`, `diet_generation`, `file_upload` — solo premium,
  altrimenti `403 PREMIUM_REQUIRED`; il log segue il salvataggio riuscito
  (nessuno per `file-read`, che non scrive nulla).

La risposta di `meal-photo` e `file-read` è una **bozza da confermare**: il
salvataggio passa dai CRUD normali (`POST /food-items`, `/workout-plans`,
`/diet-plans`), così l'utente può correggere le stime o gli errori di
lettura. `workout-generate` e `diet-generate` invece salvano loro stessi:
in app basta invalidare la cache e mostrare il risultato.

In app sono collegate tutte e quattro le route:

- **foto pasto** → Dieta → aggiungi alimento → "Foto + AI" (free 2/giorno);
- **generazione dieta** → Dieta → "Genera dieta con AI" (premium);
- **generazione scheda** → Scheda → "Crea scheda" → "Genera con AI": il piano
  è già sul server, la conferma lo apre e chiude il modal;
- **lettura file** → Scheda → "Carica file" (kind `workout`) e Dieta →
  "Importa una dieta" (kind `diet`): la bozza si mostra e si salva solo alla
  conferma. `lib/fileReader.ts` legge il file come base64 sia su web (File
  API) sia su native (`expo-file-system`).

Anche il **barcode** è collegato: Dieta → "Codice a barre" chiama
`GET /api/food-items/lookup`, dove il backend fa da proxy a **Open Food
Facts** (il PWA non dipende dal CORS del terzo e l'API esterna resta nascosta
nel server). I valori arrivano **per 100 g**: il modal li moltiplica per i
grammi dichiarati e salva con `source: "barcode"`.

Le route che ricevono file (foto e PDF in base64) hanno un parser dedicato
a 8 mb applicato solo a quel path: il resto dell'API resta vincolato a
1 mb.

### Foto dei progressi (Supabase Storage)

L'upload delle foto usa il bucket privato **`progress-photos`**, creato dalla
migrazione `20260930103000_progress_photos_storage` (blocco difensivo: lo
schema `storage` non esiste nel database shadow che Prisma usa per
`migrate dev`). RLS: inserimento, lettura e cancellazione solo per il
proprietario (`owner = auth.uid()`), soli formati JPEG/PNG/WebP e tetto a
10 mb.

`progress_photos.photo_url` conserva il **percorso** dentro il bucket (es.
`<user-id>/2026-09-30-….jpg`), non un URL: `lib/progressQueries.ts` lo
converte in URL firmati da un'ora (con cache e rigenerazione prima della
scadenza) quando compila la griglia. Così le immagini restano private, le
righe del database restano valide anche a fronte di URL scaduti e il backend
non ha bisogno di credenziali storage. L'ordine di scrittura è **file →
riga**: se `POST /api/progress-photos` fallisse resterebbe solo un file
orfano nel bucket, mentre il caso inverso romperebbe la griglia.

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
- `GEMINI_API_KEY` — **obbligatoria per le feature AI** (`/api/ai/*`),
  chiave di Google AI Studio: solo nel backend, mai nel bundle Expo
- `FOOD_FACTS_API_BASE`, `FOOD_FACTS_TIMEOUT_MS` — opzionali, override del
  proxy barcode (`/api/food-items/lookup`): di default punta a Open Food
  Facts con 8 secondi di timeout, senza chiave
- `RESEND_API_KEY` — in seguito, email transazionali (non ancora usata)

`PORT` la fornisce Render (il server usa `process.env.PORT`, nessuna porta
fissa); `DIRECT_URL` serve solo alle migrazioni Prisma, non a runtime.

### Verifica locale

```bash
npx supabase start                # DB locale (una volta)
PORT=3000 npm start               # il client Prisma carica .env da solo
python3 scripts/smoke-api.py      # 221/221 test
python3 scripts/e2e-client-flow.py # 15/15 flusso client (richiede Supabase locale)
node scripts/ai-endpoints.test.mjs # 46/46 test delle funzioni AI
node scripts/food-lookup.test.mjs  # 16/16 lookup barcode (Open Food Facts mock)
```

Lo smoke test **genera i suoi JWT** firmati con `SUPABASE_JWT_SECRET` (da
`.env`): si esercita il percorso reale di verifica, senza bypass dell'auth, e
copre anche token mancanti/malformati/firmati male/scaduti, `alg=none`, un
token **ES256 reale** preso da Supabase Auth e verificato via JWKS, e
l'isolamento fra utenti. Lo script `e2e-client-flow.py` replica invece il
flusso completo del client: signup → `404 /users/me` → onboarding → piano,
giorno ed esercizi annidati → sessione → preflight CORS.

`scripts/ai-endpoints.test.mjs` è autosufficiente: compila il backend, fa
partire un **Gemini mock** locale (`GEMINI_API_BASE` punta a lui), monta
l'app Express su una porta libera, crea utenti free/premium nel DB, esegue
le richieste con JWT reali e ripulisce tutto. Nessuna chiave Google e nessun
server già avviato: copre quota free (sotto/sopra 2), premium senza limite,
`403 PREMIUM_REQUIRED`, `201` sui tre endpoint premium, chiamata Gemini
fallita che non incrementa `ai_usage_log`, i limiti di payload e la catena
dei modelli (retry su 503, fallback su 404, quota 429 per modello, catena
esaurita).

`scripts/food-lookup.test.mjs` usa lo stesso schema con un mock di **Open
Food Facts** (`FOOD_FACTS_API_BASE` punta a lui, `FOOD_FACTS_TIMEOUT_MS` è
corto per il test del timeout): copre auth, validazione del codice, mappatura
per 100 g (nome italiano preferito), cache in memoria, prodotto ignoto,
errore e timeout del servizio terzo. Non serve il database.

Senza `PORT` il server usa 3000; se mancano `DATABASE_URL`,
`SUPABASE_JWT_SECRET`, `SUPABASE_JWKS_URL` o `ALLOWED_ORIGIN` (né `.env`)
esce con codice 1 ed elenca le variabili mancanti, così un deploy mal
configurato fallisce subito invece di dare errori a runtime.

## Produzione (cloud)

Mappa dei servizi:

| Componente | Dove |
| --- | --- |
| Postgres + Auth | Supabase cloud (project ref `akmqoezpeeichwiukuwi`) |
| Backend API | Render Web Service `https://fittrack-1-goh7.onrender.com` |
| PWA | Vercel `https://fit-track-delta-green.vercel.app` |

L'ambiente locale (Supabase CLI + server su `:3000`) resta intatto e non si
mescola con la configurazione cloud.

### Schema sul database cloud

Le migrazioni Prisma si applicano dalla macchina di sviluppo sulla
connessione **diretta** (porta 5432, IPv6-only sul piano Free — il pooler
6543 non va usato per le migrazioni):

```bash
DIRECT_URL="<connessione diretta cloud>" DATABASE_URL="<stessa stringa>" \
  npx prisma migrate deploy
npx prisma migrate status    # Database schema is up to date!
```

I valori cloud (direct/pooler, anon key, JWT secret, JWKS) stanno in
`.env.cloud.local` (git-ignored); `.env` resta la configurazione locale CLI.

### Render

Servizio creato dal blueprint `render.yaml` (build: `npm install &&
npx prisma generate && tsc -p tsconfig.server.json`, start:
`node dist-server/server/index.js`, health check `/health`). Variabili nel
dashboard (dettagli anche in "Variabili d'ambiente runtime"):

- `DATABASE_URL` — pooler cloud porta **6543** con `?pgbouncer=true`
  (**obbligatorio**: senza il flag Prisma usa i prepared statement, che nel
  transaction pooling di Supavisor falliscono a ondate → 500 intermittenti
  che appaiono e scompaiono nei minuti dopo il deploy)
- `SUPABASE_JWT_SECRET` — secret HS256 del progetto cloud
- `SUPABASE_JWKS_URL` — `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`
  (file `.json`, non `.js`: un URL sbagliato fa rispondere 401/500 su ogni
  token ES256 reale)
- `ALLOWED_ORIGIN` — CSV delle origini **senza slash finale**
  (es. `https://fit-track-delta-green.vercel.app`): il confronto con
  l'header `Origin` del browser è esatto
- `NODE_VERSION` — versione Node usata in build

### Frontend di produzione

`.env.production` (versionato — solo valori pubblici `EXPO_PUBLIC_*`) viene
caricato con `NODE_ENV=production` (`npx expo export`, build Vercel):

- `EXPO_PUBLIC_API_URL` → `https://fittrack-1-goh7.onrender.com/api`
- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` → progetto cloud

Attenzione: le `EXPO_PUBLIC_*` definite nella **dashboard Vercel** vincono
sul file (`process.env` ha priorità): un valore vuoto lì produce un bundle
con `API_BASE=""` e tutte le chiamate finiscono nei rewrite di `vercel.json`
(HTML al posto dei dati). Se il PWA non raggiunge il backend, controllare
`Settings → Environment Variables` e verificare nel bundle che la costante
`API_BASE` contenga `onrender.com`.

### PWA (manifest e icone sulla home)

`app/+html.tsx` è la shell HTML del web: oltre al tema ci mette i tag che
rendono l'app una PWA — `<link rel="manifest">`, `apple-mobile-web-app-capable`,
`mobile-web-app-capable`, `apple-touch-icon`, titolo e status bar. Senza di
essi Safari apriva l'icona della home in una finestra **normale** (con la barra
e le icone del browser) e come icona usava uno screenshot della pagina.

Il manifest è `public/manifest.json` (`display: standalone`, `start_url` e
`scope` su `/`); `expo export` lo copia nella radice di `dist/` insieme alle
icone `icon-192.png`, `icon-512.png` e `apple-touch-icon.png`, ricavate da
`assets/images/icon.png`.

iOS memorizza icona e comportamento **al momento in cui si preme "Aggiungi a
Schermata Home"**: dopo una modifica togliere l'icona e aggiungerla di nuovo,
altrimenti resta la versione precedente.

### Conferma email (Supabase Auth)

`Confirm email` resta **attiva** in produzione: il link nella mail verifica
il token sul dominio Supabase e solo dopo rimanda al **Site URL**. Per far
rientrare l'utente dentro il PWA (e non su `localhost:3000` o su una
pagina di errore del browser) in dashboard Supabase → *Authentication →
URL Configuration*:

- **Site URL** → `https://fit-track-delta-green.vercel.app/email-verified`
- **Redirect URLs** → `https://fit-track-delta-green.vercel.app/**`

La route `/(auth)/email-verified` legge la sessione dai token nell'URL,
mostra "Email verificata!" e con un pulsante entra nell'app (il guard in
`app/_layout.tsx` la salta apposta, è la pagina a gestire il flusso).
Anche senza questa configurazione la conferma avviene comunque — la verifica
avviene prima del redirect — ma l'utente si trova davanti al rimbalzo
morte verso localhost.

### Gate di produzione

Stesse suite ambientate sul cloud. Lo script E2E registra utenti veri, quindi
richiede "Confirm email" **OFF** su Supabase Auth (in produzione re-abilitarla
e usare un dominio con conferma); `smoke-api.py` fa seed psql tramite
`SMOKE_DB_URL` (pooler con `?sslmode=require`):

```bash
RENDER=https://fittrack-1-goh7.onrender.com

API_BASE=$RENDER SMOKE_DB_URL="<pooler?sslmode=require>" \
SUPABASE_JWT_SECRET="<secret cloud>" \
EXPO_PUBLIC_SUPABASE_URL=https://akmqoezpeeichwiukuwi.supabase.co \
EXPO_PUBLIC_SUPABASE_ANON_KEY="<anon key cloud>" \
python3 scripts/smoke-api.py          # 221/221

API_BASE=$RENDER CORS_ORIGIN=https://fit-track-delta-green.vercel.app \
EXPO_PUBLIC_SUPABASE_URL=https://akmqoezpeeichwiukuwi.supabase.co \
EXPO_PUBLIC_SUPABASE_ANON_KEY="<anon key cloud>" \
python3 scripts/e2e-client-flow.py    # 15/15
```

`CORS_ORIGIN` (default `http://localhost:8081`) seleziona l'origine del
preflight: in locale si usa il dev server Expo, sul cloud il dominio reale
del PWA. Ultimo gate superato su cloud: **221/221 + 15/15**.

## Approfondimenti

- [Documentazione Expo](https://docs.expo.dev)
- [Expo Router](https://docs.expo.dev/router/introduction)
- [NativeWind](https://www.nativewind.dev)