#!/usr/bin/env node
/**
 * Test degli endpoint /api/ai/* (Gemini) con **Gemini mock**.
 *
 * Avvia in-process: server mock Gemini → app Express compilata → richieste
 * HTTP reali con JWT HS256 firmati con SUPABASE_JWT_SECRET (nessun bypass
 * dell'auth), utenti free/premium creati nel DB locale e rimossi alla fine.
 *
 * Copre: quota free 2 foto/giorno (sotto, sopra, risposta invariata),
 * premium senza limite, 403 PREMIUM_REQUIRED sui tre endpoint premium-only,
 * 201 sui tre per l'utente premium, chiamata Gemini fallita che NON incrementa
 * ai_usage_log, salvataggi con source "ai" annidati, limiti di payload.
 *
 * Uso:  node scripts/ai-endpoints.test.mjs [--no-build]
 * Richiede il Supabase locale attivo (npx supabase start) e le migrazioni
 * applicate. Il build del backend è automatico (skip con --no-build).
 */
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];

/* --------------------------------------------------------------- utilità */

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? `\n     ${detail}` : ""}`);
}

/** Carica .env senza sovrascrivere l'env già presente (stessa regola di Prisma). */
function loadEnv() {
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, "");
    if (value && process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

/** JWT HS256 identico nella forma a quelli di Supabase Auth. */
function makeToken(secret, userId) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ iss: "supabase", role: "authenticated", iat: now, exp: now + 3600, sub: userId }),
  );
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

/** Richiesta HTTP JSON → {status, body, text} (mai lancia su status 4xx/5xx). */
async function call(baseUrl, method, route, { token, body, raw } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (raw !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = raw;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${baseUrl}${route}`, { method, headers, body: payload });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* body non JSON: resta il testo */
  }
  return { status: response.status, body: parsed, text };
}

/* ----------------------------------------------------------- Gemini mock */

const mock = { queue: [], calls: 0 };

/** Risposta Gemini valida con un payload JSON già serializzato dentro. */
function geminiJson(payload) {
  return { status: 200, body: { candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] } };
}

function startMockGemini() {
  const server = http.createServer((req, res) => {
    mock.calls += 1;
    let received = "";
    req.on("data", (chunk) => (received += chunk));
    req.on("end", () => {
      const next = mock.queue.shift();
      if (!next) {
        // Nessuna risposta preparata: errore rumoroso, non un successo finti
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: "mock: nessuna risposta in coda" } }));
        return;
      }
      res.writeHead(next.status, { "Content-Type": "application/json" });
      res.end(typeof next.body === "string" ? next.body : JSON.stringify(next.body));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

/* -------------------------------------------------------- payload di prova */

const WORKOUT_DRAFT = {
  name: "Scheda forza 3 giorni",
  days: [
    {
      name: "Giorno A — Push",
      exercises: [
        { name: "Panca piana", sets: 4, reps: 8, weight_kg: 60, rest_seconds: 120 },
        { name: "Military press", sets: 3, reps: 10, weight_kg: 30, rest_seconds: 90 },
      ],
    },
    {
      name: "Giorno B — Pull",
      exercises: [{ name: "Trazioni", sets: 4, reps: 8, weight_kg: 0, rest_seconds: 120 }],
    },
  ],
};

const DIET_DRAFT = {
  name: "Dieta definizione 2100",
  daily_calorie_target: 2100,
  protein_g: 160,
  carbs_g: 230,
  fat_g: 60,
  meals: [
    {
      meal_type: "breakfast",
      name: "Colazione",
      foods: [{ name: "Fiocchi d'avena", quantity_g: 80, calories: 300, protein_g: 11, carbs_g: 54, fat_g: 5 }],
    },
    {
      meal_type: "lunch",
      name: "Pranzo",
      foods: [{ name: "Riso", quantity_g: 100, calories: 360, protein_g: 7, carbs_g: 78, fat_g: 1 }],
    },
  ],
};

const MEAL_PHOTO_DRAFT = {
  items: [
    { name: "Petto di pollo", quantity_g: 150, calories: 248, protein_g: 46, carbs_g: 0, fat_g: 5 },
    { name: "Riso basmati", quantity_g: 180, calories: 234, protein_g: 4, carbs_g: 52, fat_g: 1 },
  ],
  notes: "stima indicativa",
};

const FILE_READ_DRAFT = {
  kind: "workout",
  workout: WORKOUT_DRAFT,
  notes: "pesi non leggibili in un esercizio",
};

/* ------------------------------------------------------------------ test */

async function main() {
  loadEnv();

  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    console.error("SUPABASE_JWT_SECRET assente: imposta .env o l'ambiente.");
    process.exit(1);
  }

  if (!process.argv.includes("--no-build")) {
    console.log("Build del backend (tsc -p tsconfig.server.json)…");
    const build = spawnSync("npx", ["tsc", "-p", "tsconfig.server.json"], {
      cwd: ROOT,
      stdio: "inherit",
    });
    if (build.status !== 0) process.exit(build.status ?? 1);
  }

  // Gemini mock raggiungibile solo dal processo qui sotto: la chiave e
  // l'endpoint sono env del backend, mai valori reali nei test.
  const mockServer = await startMockGemini();
  const mockPort = mockServer.address().port;
  process.env.GEMINI_API_BASE = `http://127.0.0.1:${mockPort}`;
  process.env.GEMINI_API_KEY = "chiave-di-test";
  process.env.GEMINI_TIMEOUT_MS = "10000";

  const { createApp } = await import(pathToFileURL(path.join(ROOT, "dist-server/server/app.js")));
  const { prisma } = await import(pathToFileURL(path.join(ROOT, "dist-server/lib/prisma.js")));
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const freeId = crypto.randomUUID();
  const free2Id = crypto.randomUUID();
  const premiumId = crypto.randomUUID();
  const tokens = {
    free: makeToken(secret, freeId),
    free2: makeToken(secret, free2Id),
    premium: makeToken(secret, premiumId),
  };
  const email = (tag) => `ai-${tag}-${Date.now()}@test.it`;

  /** Usi di oggi di una feature via l'endpoint pubblico (GET-equivalente). */
  const usage = (token, feature) =>
    call(base, "GET", `/api/ai-usage-log/today?feature=${feature}`, { token });

  try {
    const health = await call(base, "GET", "/health");
    check("server avviato e /health → 200", health.status === 200 && health.text === "OK", health.text);

    await prisma.users.createMany({
      data: [
        { id: freeId, email: email("free"), name: "Free", goal: "lose", activity_level: "moderate", subscription_status: "free" },
        { id: free2Id, email: email("free2"), name: "Free bis", goal: "lose", activity_level: "moderate", subscription_status: "free" },
        { id: premiumId, email: email("premium"), name: "Premium", goal: "gain", activity_level: "active", subscription_status: "premium" },
      ],
    });

    /* --- autenticazione */
    const noAuth = await call(base, "POST", "/api/ai/meal-photo", {
      body: { photo: "AAAA", mime_type: "image/jpeg" },
    });
    check("senza token → 401 UNAUTHENTICATED", noAuth.status === 401 && noAuth.body?.error?.code === "UNAUTHENTICATED", noAuth.text.slice(0, 200));

    /* --- quota free: sotto e sopra il limite di 2 foto/giorno */
    mock.queue.push(geminiJson(MEAL_PHOTO_DRAFT));
    const first = await call(base, "POST", "/api/ai/meal-photo", {
      token: tokens.free,
      body: { photo: "AAAA", mime_type: "image/jpeg", description: "pollo e riso" },
    });
    check("free: foto 1 → 201 con items compatibili con food_items", first.status === 201 &&
      Array.isArray(first.body?.items) && first.body.items.length === 2 &&
      typeof first.body.items[0].name === "string" &&
      typeof first.body.items[0].quantity_g === "number" &&
      typeof first.body.items[0].calories === "number" &&
      typeof first.body.items[0].protein_g === "number" &&
      typeof first.body.items[0].carbs_g === "number" &&
      typeof first.body.items[0].fat_g === "number", first.text.slice(0, 300));
    check("free: foto 1 → remaining_today = 1", first.body?.remaining_today === 1, JSON.stringify(first.body?.remaining_today));

    const countAfterFirst = await usage(tokens.free, "photo_meal");
    check("free: foto 1 → ai_usage_log.count = 1", countAfterFirst.body?.count === 1, countAfterFirst.text);

    mock.queue.push(geminiJson(MEAL_PHOTO_DRAFT));
    const second = await call(base, "POST", "/api/ai/meal-photo", {
      token: tokens.free,
      body: { photo: "AAAA", mime_type: "image/jpeg" },
    });
    check("free: foto 2 → 201 (sotto il limite)", second.status === 201, second.text.slice(0, 300));
    check("free: foto 2 → remaining_today = 0", second.body?.remaining_today === 0, JSON.stringify(second.body?.remaining_today));

    const countAfterSecond = await usage(tokens.free, "photo_meal");
    check("free: foto 2 → ai_usage_log.count = 2", countAfterSecond.body?.count === 2, countAfterSecond.text);

    const callsBeforeOverLimit = mock.calls;
    const third = await call(base, "POST", "/api/ai/meal-photo", {
      token: tokens.free,
      body: { photo: "AAAA", mime_type: "image/jpeg" },
    });
    check("free: foto 3 → 403 DAILY_LIMIT_REACHED", third.status === 403 && third.body?.error?.code === "DAILY_LIMIT_REACHED", third.text.slice(0, 300));
    check("free: quota esaurita → Gemini NON viene chiamato", mock.calls === callsBeforeOverLimit, `chiamate mock: ${mock.calls - callsBeforeOverLimit}`);
    const countOverLimit = await usage(tokens.free, "photo_meal");
    check("free: quota esaurita → count resta 2", countOverLimit.body?.count === 2, countOverLimit.text);

    /* --- free sugli endpoint premium-only */
    const freeWorkout = await call(base, "POST", "/api/ai/workout-generate", {
      token: tokens.free,
      body: { goal: "massa", days_per_week: 3 },
    });
    check("free: workout-generate → 403 PREMIUM_REQUIRED", freeWorkout.status === 403 && freeWorkout.body?.error?.code === "PREMIUM_REQUIRED", freeWorkout.text.slice(0, 300));

    const freeDiet = await call(base, "POST", "/api/ai/diet-generate", {
      token: tokens.free,
      body: { goal: "dimagrire", meals_per_day: 4 },
    });
    check("free: diet-generate → 403 PREMIUM_REQUIRED", freeDiet.status === 403 && freeDiet.body?.error?.code === "PREMIUM_REQUIRED", freeDiet.text.slice(0, 300));

    const freeFile = await call(base, "POST", "/api/ai/file-read", {
      token: tokens.free,
      body: { file: "AAAA", mime_type: "image/jpeg" },
    });
    check("free: file-read → 403 PREMIUM_REQUIRED", freeFile.status === 403 && freeFile.body?.error?.code === "PREMIUM_REQUIRED", freeFile.text.slice(0, 300));

    const freePlans = await call(base, "GET", "/api/workout-plans", { token: tokens.free });
    check("free: nessun piano creato e nessun uso registrato", (freePlans.body ?? []).length === 0, JSON.stringify(freePlans.body ?? []).slice(0, 200));

    /* --- premium: nessun limite sulla foto */
    for (let i = 0; i < 3; i += 1) {
      mock.queue.push(geminiJson(MEAL_PHOTO_DRAFT));
    }
    let premiumPhotoOk = true;
    let premiumRemaining = null;
    for (let i = 0; i < 3; i += 1) {
      const response = await call(base, "POST", "/api/ai/meal-photo", {
        token: tokens.premium,
        body: { photo: "AAAA", mime_type: "image/jpeg" },
      });
      premiumPhotoOk = premiumPhotoOk && response.status === 201;
      premiumRemaining = response.body?.remaining_today;
    }
    check("premium: 3 foto di fila → 201 (nessun limite)", premiumPhotoOk, "");
    check("premium: remaining_today = null (illimitato)", premiumRemaining === null, JSON.stringify(premiumRemaining));
    const premiumCount = await usage(tokens.premium, "photo_meal");
    check("premium: ai_usage_log.count = 3", premiumCount.body?.count === 3, premiumCount.text);

    /* --- premium: generazione scheda (salvataggio annidato) */
    mock.queue.push(geminiJson(WORKOUT_DRAFT));
    const workout = await call(base, "POST", "/api/ai/workout-generate", {
      token: tokens.premium,
      body: { goal: "forza", level: "intermedio", days_per_week: 2, equipment: ["bilanciere"] },
    });
    const workoutPlan = workout.body;
    check("premium: workout-generate → 201 con source \"ai\"", workout.status === 201 && workoutPlan?.source === "ai" && workoutPlan?.user_id === premiumId, workout.text.slice(0, 300));
    check("premium: workout con giorni ed esercizi annidati", workoutPlan?.workout_days?.length === 2 &&
      workoutPlan.workout_days[0].day_order === 0 &&
      workoutPlan.workout_days[0].exercises?.length === 2 &&
      workoutPlan.workout_days[0].exercises[0].order_index === 0 &&
      workoutPlan.workout_days[0].exercises[0].sets === 4, JSON.stringify(workoutPlan?.workout_days ?? {}).slice(0, 300));
    const workoutUsage = await usage(tokens.premium, "workout_generation");
    check("premium: uso registrato dopo il salvataggio (count 1)", workoutUsage.body?.count === 1, workoutUsage.text);

    /* --- premium: generazione dieta (pasti + alimenti annidati) */
    mock.queue.push(geminiJson(DIET_DRAFT));
    const diet = await call(base, "POST", "/api/ai/diet-generate", {
      token: tokens.premium,
      body: { goal: "definizione", allergies: ["glutine"], diet_type: "onnivoro", meals_per_day: 2 },
    });
    const dietPlan = diet.body;
    check("premium: diet-generate → 201 con source \"ai\"", diet.status === 201 && dietPlan?.source === "ai" && dietPlan?.daily_calorie_target === 2100, diet.text.slice(0, 300));
    check("premium: dieta con pasti e alimenti annidati", dietPlan?.meals?.length === 2 &&
      dietPlan.meals[0].meal_type === "breakfast" &&
      dietPlan.meals[0].food_items?.length === 1 &&
      dietPlan.meals[0].food_items[0].source === "ai" &&
      dietPlan.meals[0].user_id === premiumId, JSON.stringify(dietPlan?.meals ?? {}).slice(0, 300));
    const dietUsage = await usage(tokens.premium, "diet_generation");
    check("premium: uso registrato dopo il salvataggio (count 1)", dietUsage.body?.count === 1, dietUsage.text);

    /* --- premium: lettura file (nessun salvataggio, solo bozza) */
    mock.queue.push(geminiJson(FILE_READ_DRAFT));
    const fileRead = await call(base, "POST", "/api/ai/file-read", {
      token: tokens.premium,
      body: { file: "AAAA", mime_type: "image/jpeg", kind: "auto" },
    });
    check("premium: file-read → 201 con struttura estratta", fileRead.status === 201 &&
      fileRead.body?.kind === "workout" &&
      fileRead.body?.workout?.days?.length === 2, fileRead.text.slice(0, 300));
    const plansAfterRead = await call(base, "GET", "/api/workout-plans", { token: tokens.premium });
    const dietsAfterRead = await call(base, "GET", "/api/diet-plans", { token: tokens.premium });
    const planNames = (plansAfterRead.body ?? []).map((plan) => `${plan.name}:${plan.source}`);
    const dietNames = (dietsAfterRead.body ?? []).map((plan) => `${plan.name}:${plan.source}`);
    check("premium: file-read NON salva (solo i due piani generati sono a DB)", planNames.length === 1 && planNames[0] === `${WORKOUT_DRAFT.name}:ai` && dietNames.length === 1 && dietNames[0] === `${DIET_DRAFT.name}:ai`, JSON.stringify({ planNames, dietNames }));
    const fileUsage = await usage(tokens.premium, "file_upload");
    check("premium: uso file_upload registrato (count 1)", fileUsage.body?.count === 1, fileUsage.text);

    /* --- chiamata Gemini fallita → nessun incremento del log */
    mock.queue.push({ status: 500, body: { error: { message: "internal error" } } });
    const googleDown = await call(base, "POST", "/api/ai/meal-photo", {
      token: tokens.premium,
      body: { photo: "AAAA", mime_type: "image/jpeg" },
    });
    check("Gemini 5xx → 502 GEMINI_ERROR", googleDown.status === 502 && googleDown.body?.error?.code === "GEMINI_ERROR", googleDown.text.slice(0, 300));
    const premiumCountAfterFailure = await usage(tokens.premium, "photo_meal");
    check("Gemini fallito → ai_usage_log invariato (3)", premiumCountAfterFailure.body?.count === 3, premiumCountAfterFailure.text);

    mock.queue.push({ status: 200, body: { candidates: [{ content: { parts: [{ text: "non è JSON" }] } }] } });
    const badJson = await call(base, "POST", "/api/ai/meal-photo", {
      token: tokens.free2,
      body: { photo: "AAAA", mime_type: "image/jpeg" },
    });
    check("risposta Gemini non parsabile → 502 GEMINI_INVALID_RESPONSE", badJson.status === 502 && badJson.body?.error?.code === "GEMINI_INVALID_RESPONSE", badJson.text.slice(0, 300));
    const free2CountAfterFailure = await usage(tokens.free2, "photo_meal");
    check("risposta non parsabile → count resta 0", free2CountAfterFailure.body?.count === 0, free2CountAfterFailure.text);

    mock.queue.push(geminiJson(MEAL_PHOTO_DRAFT));
    const recovery = await call(base, "POST", "/api/ai/meal-photo", {
      token: tokens.free2,
      body: { photo: "AAAA", mime_type: "image/jpeg" },
    });
    const free2CountAfterSuccess = await usage(tokens.free2, "photo_meal");
    check("poi successo → 201 e count 1 (la quota scatta solo al successo)", recovery.status === 201 && free2CountAfterSuccess.body?.count === 1, `${recovery.status} / ${free2CountAfterSuccess.text}`);

    /* --- limiti di payload (parser dedicato solo per foto e file) */
    const bigPhoto = "A".repeat(2 * 1024 * 1024);
    mock.queue.push(geminiJson(MEAL_PHOTO_DRAFT));
    const big = await call(base, "POST", "/api/ai/meal-photo", {
      token: tokens.premium,
      body: { photo: bigPhoto, mime_type: "image/jpeg" },
    });
    check("foto da 2MB → 201 (limite alto solo su /api/ai/meal-photo)", big.status === 201, `atteso 201, ricevuto ${big.status}: ${big.text.slice(0, 200)}`);

    mock.queue.push(geminiJson(FILE_READ_DRAFT));
    const bigFile = await call(base, "POST", "/api/ai/file-read", {
      token: tokens.premium,
      body: { file: bigPhoto, mime_type: "image/jpeg" },
    });
    check("file da 2MB su /api/ai/file-read → 201", bigFile.status === 201 && bigFile.body?.kind === "workout", `atteso 201, ricevuto ${bigFile.status}: ${bigFile.text.slice(0, 200)}`);
    const fileUsageAfterBig = await usage(tokens.premium, "file_upload");
    check("file_upload: count = 2 (le due letture riuscite)", fileUsageAfterBig.body?.count === 2, fileUsageAfterBig.text);

    const bigBody = JSON.stringify({ name: "x", source: "manual", pad: "B".repeat(2 * 1024 * 1024) });
    const tooLarge = await call(base, "POST", "/api/workout-plans", { token: tokens.premium, raw: bigBody });
    check("corpo >1mb su altra route → 413 PAYLOAD_TOO_LARGE", tooLarge.status === 413 && tooLarge.body?.error?.code === "PAYLOAD_TOO_LARGE", tooLarge.text.slice(0, 200));
  } finally {
    await prisma.users.deleteMany({ where: { id: { in: [freeId, free2Id, premiumId] } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
    // fetch (undici) tiene le connessioni in keep-alive: senza chiuderle qui
    // server.close() aspetterebbe all'infinito.
    await Promise.all([server, mockServer].map((s) => new Promise((resolve) => {
      if (typeof s.closeAllConnections === "function") s.closeAllConnections();
      s.close(resolve);
    })));
  }

  const failed = results.filter((result) => !result.ok).length;
  console.log(`\n${results.length - failed}/${results.length} test superati`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
