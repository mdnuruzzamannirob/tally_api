import { describe, expect, it } from "vitest";

import { parseEnvironment } from "../../../src/core/config/env.schema.js";

const developmentEnvironment = {
  DATABASE_URL: "postgresql://tally:tally@localhost:5433/tally",
  API_BASE_URL: "http://localhost:4000",
  WEB_APP_URL: "http://localhost:3000",
  ACCESS_TOKEN_SECRET: "a-local-development-secret",
  EMAIL_FROM: "no-reply@tally.local",
};

const productionEnvironment = {
  ...developmentEnvironment,
  NODE_ENV: "production",
  ACCESS_TOKEN_SECRET: "a".repeat(32),
  EMAIL_PROVIDER: "sendgrid",
  EMAIL_API_KEY: "email-api-key",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  GITHUB_CLIENT_ID: "github-client-id",
  GITHUB_CLIENT_SECRET: "github-client-secret",
  COOKIE_SECURE: "true",
  COOKIE_SAME_SITE: "none",
};

describe("environment configuration", () => {
  it("parses development defaults into typed values", () => {
    const env = parseEnvironment(developmentEnvironment);

    expect(env).toMatchObject({
      NODE_ENV: "development",
      PORT: 5000,
      COOKIE_SECURE: false,
      COOKIE_SAME_SITE: "lax",
      EMAIL_PROVIDER: "console",
    });
  });

  it("accepts complete production configuration", () => {
    expect(parseEnvironment(productionEnvironment)).toMatchObject({
      NODE_ENV: "production",
      COOKIE_SECURE: true,
      COOKIE_SAME_SITE: "none",
    });
  });

  it("rejects unsafe production configuration", () => {
    expect(() =>
      parseEnvironment({
        ...productionEnvironment,
        ACCESS_TOKEN_SECRET: "too-short",
        EMAIL_PROVIDER: "console",
        COOKIE_SECURE: "false",
        COOKIE_SAME_SITE: "lax",
        GOOGLE_CLIENT_SECRET: "",
      }),
    ).toThrow(/at least 32 bytes|Console email|Must be true|Must be none|GOOGLE_CLIENT_SECRET/);
  });

  it("rejects invalid connection URLs before startup", () => {
    expect(() =>
      parseEnvironment({ ...developmentEnvironment, DATABASE_URL: "mysql://localhost/tally" }),
    ).toThrow(/PostgreSQL connection URL/);
  });

  it("requires SMTP connection settings when SMTP is selected", () => {
    expect(() =>
      parseEnvironment({
        ...productionEnvironment,
        EMAIL_PROVIDER: "smtp",
        EMAIL_API_KEY: undefined,
      }),
    ).toThrow(/EMAIL_SMTP_HOST|EMAIL_SMTP_PORT|EMAIL_SMTP_USER|EMAIL_SMTP_PASSWORD/);
  });

  it("accepts complete SMTP configuration", () => {
    expect(
      parseEnvironment({
        ...productionEnvironment,
        EMAIL_PROVIDER: "smtp",
        EMAIL_API_KEY: undefined,
        EMAIL_SMTP_HOST: "smtp.example.test",
        EMAIL_SMTP_PORT: "587",
        EMAIL_SMTP_USER: "mailer",
        EMAIL_SMTP_PASSWORD: "secret",
      }),
    ).toMatchObject({ EMAIL_PROVIDER: "smtp", EMAIL_SMTP_PORT: 587 });
  });
});
