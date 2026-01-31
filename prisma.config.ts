// PeopleOS PH - Prisma Configuration (Prisma 7+)
// npm install --save-dev prisma dotenv
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed/index.ts",
  },
  datasource: {
    // Primary connection URL (uses pgbouncer on Vercel)
    url: process.env["DATABASE_URL"]!,
    // Direct URL is configured via DIRECT_URL env var in schema.prisma
    // and handled automatically by Prisma
  },
});
