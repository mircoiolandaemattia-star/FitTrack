import { prisma } from "../lib/prisma";
import { createApp } from "./app";

// Su Render la porta è assegnata dal platform: il server deve leggere
// process.env.PORT, mai una porta fissa.
const port = Number(process.env.PORT ?? 3000);

// Variabili obbligatorie a runtime (vedi .env.example). `src/lib/prisma`
// carica `.env` in locale all'import, quindi qui il check è affidabile.
// JWKS: serve a verificare i token utente ES256 emessi da Supabase Auth
// (l'HS256 da solo basta solo per le chiavi simmetriche legacy).
const missingEnv = [
  "DATABASE_URL",
  "SUPABASE_JWT_SECRET",
  "SUPABASE_JWKS_URL",
  "ALLOWED_ORIGIN",
].filter(
  (name) => !process.env[name],
);
if (missingEnv.length > 0) {
  console.error(
    `[fittrack-api] Variabili d'ambiente mancanti: ${missingEnv.join(", ")}. ` +
      "Vedi .env.example → Variabili d'ambiente runtime.",
  );
  process.exit(1);
}

const server = createApp().listen(port, "0.0.0.0", () => {
  console.log(`[fittrack-api] in ascolto su http://0.0.0.0:${port}`);
});

// Chiusura pulita durante i ri-deploy di Render
function shutdown(signal: string) {
  console.log(`[fittrack-api] ${signal}: chiusura in corso…`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
