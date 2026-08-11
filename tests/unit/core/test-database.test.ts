import { describe, expect, it } from "vitest";

import { getTestDatabaseUrl } from "../../../src/core/database/test-database.js";

const environment = {
  DATABASE_URL: "postgresql://tally:tally@localhost:5433/tally",
  TEST_DATABASE_URL: "postgresql://tally:tally@localhost:5433/tally_test",
  API_BASE_URL: "http://localhost:4000",
  WEB_APP_URL: "http://localhost:3000",
  ACCESS_TOKEN_SECRET: "local-development-secret",
  EMAIL_FROM: "no-reply@tally.local",
};

describe("test database configuration", () => {
  it("uses the explicitly configured isolated test database", () => {
    expect(getTestDatabaseUrl(environment)).toBe(environment.TEST_DATABASE_URL);
  });

  it("refuses to run database tests without an isolated database URL", () => {
    expect(() => getTestDatabaseUrl({ ...environment, TEST_DATABASE_URL: undefined })).toThrow(
      "TEST_DATABASE_URL is required",
    );
  });
});
