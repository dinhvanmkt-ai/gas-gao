import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts",
  },
  datasource: {
    // For migrations: use DIRECT_URL (port 5432, bypasses pooler)
    // For runtime: PrismaClient reads DATABASE_URL via env directly
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"]!,
  },
});
