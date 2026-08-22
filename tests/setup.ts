import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

process.env.NODE_ENV ??= "test";
if (process.env.REQUIRE_TEST_DATABASE === "true" && !process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is required for integration tests.");
}
process.env.DATABASE_URL ??=
  process.env.TEST_DATABASE_URL ?? "postgresql://test:test@example.test/tally_test";
process.env.API_BASE_URL ??= "http://localhost:4000";
process.env.WEB_APP_URL ??= "http://localhost:3000";
process.env.ACCESS_TOKEN_SECRET ??= "test-access-token-secret-at-least-32-bytes";
process.env.EMAIL_FROM ??= "no-reply@tally.local";
