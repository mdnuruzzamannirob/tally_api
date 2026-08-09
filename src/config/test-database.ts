import { parseEnvironment } from "./env.schema.js";

/**
 * Returns the isolated test-database URL. Test runners must set this explicitly
 * so no test can silently use the development or production database.
 */
export function getTestDatabaseUrl(input: NodeJS.ProcessEnv = process.env): string {
  const url = input.TEST_DATABASE_URL;

  if (!url) throw new Error("TEST_DATABASE_URL is required when running database tests.");

  return parseEnvironment({
    ...input,
    DATABASE_URL: url,
  }).DATABASE_URL;
}
