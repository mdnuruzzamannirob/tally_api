import { PrismaPg } from "@prisma/adapter-pg";

import { getTestDatabaseUrl } from "../../src/core/database/test-database.js";
import { PrismaClient } from "../../src/generated/prisma/client.js";

/** Creates a Prisma client that can only connect to TEST_DATABASE_URL. */
export function createTestPrismaClient(input: NodeJS.ProcessEnv = process.env): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: getTestDatabaseUrl(input) }),
  });
}

/** Deletes all user-owned records through database cascade rules. */
export async function clearTestDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.user.deleteMany();
}
