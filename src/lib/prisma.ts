import { PrismaClient } from "@prisma/client";

/**
 * Istanza Prisma singleton: un solo pool di connessioni per processo.
 * Il riferimento su `globalThis` sopravvive ai reload in sviluppo,
 * dove il modulo viene reimportato creando altrimenti un nuovo client.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

globalForPrisma.prisma = prisma;
