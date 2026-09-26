import { prisma } from "../lib/prisma";
import { createApp } from "./app";

// Su Render la porta è assegnata dal platform: il server deve leggere
// process.env.PORT, mai una porta fissa.
const port = Number(process.env.PORT ?? 3000);

if (!process.env.DATABASE_URL) {
  console.error(
    "[fittrack-api] DATABASE_URL mancante: imposta la variabile d'ambiente " +
      "(vedi .env.example → Variabili d'ambiente runtime).",
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
