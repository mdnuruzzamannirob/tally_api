process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??=
  process.env.TEST_DATABASE_URL ?? "postgresql://test:test@example.test/tally_test";
process.env.WEB_APP_URL ??= "http://localhost:3000";
process.env.ACCESS_TOKEN_SECRET ??= "test-access-token-secret-at-least-32-bytes";
process.env.EMAIL_FROM ??= "no-reply@tally.local";
