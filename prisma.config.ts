import "dotenv/config";

import { defineConfig, env } from "prisma/config";

const migrationUrl = process.env.MIGRATION_DATABASE_URL || env("DATABASE_URL");

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationUrl,
  },
});
