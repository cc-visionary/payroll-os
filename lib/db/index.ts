// =============================================================================
// PeopleOS PH - Prisma Client (Neon DB)
// =============================================================================
// Singleton Prisma client with connection pooling for Neon serverless PostgreSQL.
// Uses @prisma/adapter-pg for Prisma 7+ compatibility with SSL enabled.
// =============================================================================

import { PrismaClient } from "@/app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool, PoolConfig } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  // Neon-optimized pool configuration
  const poolConfig: PoolConfig = {
    connectionString,
    // SSL is required for Neon cloud PostgreSQL
    ssl: {
      rejectUnauthorized: true, // Verify SSL certificate
    },
    // Connection pool settings optimized for Neon pooler
    max: 10, // Maximum connections (Neon pooler handles scaling)
    idleTimeoutMillis: 30000, // Close idle connections after 30s
    connectionTimeoutMillis: 10000, // Timeout after 10s when acquiring connection
  };

  const pool = new Pool(poolConfig);

  // Store pool globally for cleanup
  globalForPrisma.pool = pool;

  // Handle pool errors gracefully
  pool.on("error", (err) => {
    console.error("Unexpected database pool error:", err);
  });

  // Create Prisma adapter
  const adapter = new PrismaPg(pool);

  // Create Prisma client with adapter
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown helper for Electron app
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  if (globalForPrisma.pool) {
    await globalForPrisma.pool.end();
  }
}
