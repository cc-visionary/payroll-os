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

  // Skip validation during Next.js build phase
  const isBuildTime = process.env.NEXT_PHASE === "phase-production-build";

  if (!connectionString && !isBuildTime) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  // Return a mock client during build time
  if (!connectionString) {
    return {} as PrismaClient;
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

// Lazy initialization to avoid build-time errors
function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

// Export a proxy that lazily initializes prisma on first access
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = client[prop as keyof PrismaClient];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});

// Graceful shutdown helper for Electron app
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  if (globalForPrisma.pool) {
    await globalForPrisma.pool.end();
  }
}
