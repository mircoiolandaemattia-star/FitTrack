#!/usr/bin/env node
/**
 * Test del lookup barcode (`GET /api/food-items/lookup`, Open Food Facts).
 *
 * Avvia in-process: server mock di Open Food Facts → app Express compilata →
 * richieste HTTP reali con JWT HS256 firmati con SUPABASE_JWT_SECRET (nessun
 * bypass dell'auth). Nessuna riga nel DB: l'endpoint è un proxy in lettura.
 *
 * Copre: auth, barcode non valido, mappatura per 100 g (con preferenza del
 * nome italiano), cache in memoria, prodotto ignoto (404), errore del
 * servizio terzo (502) e timeout (502).
 *
 * Uso:  node scripts/food-lookup.test.mjs [--no-build]
 * Richiede .env con DATABASE_URL e SUPABASE_JWT_SECRET (Supabase locale non
 * deve per forza essere attivo: qui non si interroga il database).
 */
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];

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
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

/** Richiesta HTTP JSON → {status, body, text} (mai lancia su 4xx/5xx). */
async function call(baseUrl, route, { token } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${route}`, { method: "GET", headers });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* body non JSON: resta il testo */
  }
  return { status: response.status, body: parsed, text };
}

/* ------------------------------------------------- Open Food Facts mock */

const mock = {
  calls: 0,
  /** code → {status, body} oppure {hang: true} per simulare il timeout. */
  routes: new Map(),
};

function startMockFoodFacts() {
  const server = http.createServer((req, res) => {
    mock.calls += 1;
    const match = /^\/api\/v2\/product\/(\d+)\.json/.exec(req.url ?? "");
    const entry = match ? mock.routes.get(match[1]) : undefined;
    if (!entry) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: match?.[1] ?? "", status: 0, status_verbose: "product not found" }));
      return;
    }
    if (entry.hang) return; // nessuna risposta: il client deve scadere sul timeout
    res.writeHead(entry.status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(entry.body));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

/* ------------------------------------------------------------ payload di prova */

const CODE_OK = "8000500310427";
const CODE_NO_NUTRIENTS = "8000500310429";
const CODE_MISSING = "4000000000000";
const CODE_UPSTREAM_ERROR = "5000000000001";
const CODE_UPSTREAM_HANG = "6000000000001";

function product(payload) {
  return { status: 1, status_verbose: "ok", product: payload };
}

async function main() {
  loadEnv();

  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    console.error("SUPABASE_JWT_SECRET assente: imposta .env o l'ambiente.");
    process.exit(1);
  }

  if (!process.argv.includes("--no-build")) {
    console.log("Build del backend (tsc -p tsconfig.server.json)…");
    const build = spawnSync("npx", ["tsc", "-p", "tsconfig.server.json"], { cwd: ROOT, stdio: "inherit" });
    if (build.status !== 0) process.exit(build.status ?? 1);
  }

  const mockServer = await startMockFoodFacts();
  const mockPort = mockServer.address().port;
  process.env.FOOD_FACTS_API_BASE = `http://127.0.0.1:${mockPort}`;
  process.env.FOOD_FACTS_TIMEOUT_MS = "300";

  // Prodotto completo: nome italiano da preferire, nutrienti per 100 g.
  mock.routes.set(CODE_OK, {
    status: 200,
    body: product({
      product_name: "Cola drink",
      product_name_it: "Bevanda cola",
      brands: "Esempio S.p.A.",
      quantity: "33 cl",
      serving_quantity: 33,
      nutriments: {
        "energy-kcal_100g": "42.5",
        proteins_100g: 0,
        carbohydrates_100g: 10.6,
        fat_100g: 0,
      },
    }),
  });
  // Prodotto senza tabella nutrizionale: serve per il notes di avvertenza.
  mock.routes.set(CODE_NO_NUTRIENTS, {
    status: 200,
    body: product({ product_name: "Prodottino senza dati", brands: "Marca" }),
  });
  mock.routes.set(CODE_UPSTREAM_ERROR, { status: 500, body: { status: 1, product: { product_name: "Non deve passare" } } });
  mock.routes.set(CODE_UPSTREAM_HANG, { hang: true });

  const { createApp } = await import(pathToFileURL(path.join(ROOT, "dist-server/server/app.js")));
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = makeToken(secret, crypto.randomUUID());

  try {
    const health = await call(base, "/health");
    check("server avviato e /health → 200", health.status === 200 && health.text === "OK", health.text);

    /* --- autenticazione */
    const noAuth = await call(base, `/api/food-items/lookup?barcode=${CODE_OK}`);
    check("senza token → 401 UNAUTHENTICATED", noAuth.status === 401 && noAuth.body?.error?.code === "UNAUTHENTICATED", noAuth.text.slice(0, 200));

    /* --- validazione del codice */
    const invalid = await call(base, "/api/food-items/lookup?barcode=abc", { token });
    check("barcode non numerico → 400 VALIDATION_ERROR", invalid.status === 400 && invalid.body?.error?.code === "VALIDATION_ERROR", invalid.text.slice(0, 200));
    const tooShort = await call(base, "/api/food-items/lookup?barcode=123", { token });
    check("barcode troppo corto → 400 VALIDATION_ERROR", tooShort.status === 400 && tooShort.body?.error?.code === "VALIDATION_ERROR", tooShort.text.slice(0, 200));

    /* --- prodotto trovato */
    const found = await call(base, `/api/food-items/lookup?barcode=${CODE_OK}`, { token });
    check("prodotto trovato → 200", found.status === 200, found.text.slice(0, 300));
    check("risposta con valori per 100 g", found.body?.quantity_g === 100 && found.body?.calories === 43 && found.body?.protein_g === 0 && found.body?.carbs_g === 10.6 && found.body?.fat_g === 0, JSON.stringify(found.body));
    check("nome italiano preferito su quello inglese", found.body?.name === "Bevanda cola", JSON.stringify(found.body?.name));
    check("brand e porzione dichiarati", found.body?.brand === "Esempio S.p.A." && found.body?.serving_g === 33, JSON.stringify({ brand: found.body?.brand, serving_g: found.body?.serving_g }));
    check("niente notes quando i dati ci sono", found.body?.notes === null, JSON.stringify(found.body?.notes));

    /* --- cache in memoria (nessuna seconda chiamata a OFF) */
    const callsBeforeCache = mock.calls;
    const cached = await call(base, `/api/food-items/lookup?barcode=${CODE_OK}`, { token });
    check("seconda richiesta → sempre 200", cached.status === 200, cached.text.slice(0, 200));
    check("risposta servita dalla cache (mock non richiamato)", mock.calls === callsBeforeCache, `chiamate extra al mock: ${mock.calls - callsBeforeCache}`);

    /* --- dati nutrizionali mancanti */
    const withoutNutrients = await call(base, `/api/food-items/lookup?barcode=${CODE_NO_NUTRIENTS}`, { token });
    check("prodotto senza kcal → notes di avvertenza", withoutNutrients.status === 200 && typeof withoutNutrients.body?.notes === "string" && withoutNutrients.body.calories === 0, withoutNutrients.text.slice(0, 300));

    /* --- prodotto ignoto */
    const missing = await call(base, `/api/food-items/lookup?barcode=${CODE_MISSING}`, { token });
    check("prodotto ignoto → 404 PRODUCT_NOT_FOUND", missing.status === 404 && missing.body?.error?.code === "PRODUCT_NOT_FOUND", missing.text.slice(0, 300));

    /* --- errore e timeout del servizio terzo */
    const upstreamError = await call(base, `/api/food-items/lookup?barcode=${CODE_UPSTREAM_ERROR}`, { token });
    check("Open Food Facts in errore → 502 FOOD_FACTS_UNAVAILABLE", upstreamError.status === 502 && upstreamError.body?.error?.code === "FOOD_FACTS_UNAVAILABLE", upstreamError.text.slice(0, 300));
    const timeout = await call(base, `/api/food-items/lookup?barcode=${CODE_UPSTREAM_HANG}`, { token });
    check("Open Food Facts che non risponde → 502 FOOD_FACTS_UNAVAILABLE", timeout.status === 502 && timeout.body?.error?.code === "FOOD_FACTS_UNAVAILABLE", timeout.text.slice(0, 300));

    /* --- nessun effetto collaterale sulle altre rotte food-items */
    const shadowed = await call(base, "/api/food-items/lookup", { token });
    check("lookup senza parametro → 400 (non catturato da /food-items/:id)", shadowed.status === 400 && shadowed.body?.error?.code === "VALIDATION_ERROR", shadowed.text.slice(0, 300));
  } finally {
    await Promise.all(
      [server, mockServer].map(
        (s) =>
          new Promise((resolve) => {
            if (typeof s.closeAllConnections === "function") s.closeAllConnections();
            s.close(resolve);
          }),
      ),
    );
  }

  const failed = results.filter((result) => !result.ok).length;
  console.log(`\n${results.length - failed}/${results.length} test superati`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
