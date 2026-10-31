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
  SENDGRID_API_KEY: "email-api-key",
  SENDGRID_FROM: "no-reply@tally.local",
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

  it("requires real email credentials in local mode too", () => {
    expect(() => parseEnvironment({ ...developmentEnvironment, EMAIL_PROVIDER: "resend" })).toThrow(
      /RESEND_API_KEY/,
    );
    expect(
      parseEnvironment({
        ...developmentEnvironment,
        EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "local-test-key",
        RESEND_FROM: "onboarding@resend.dev",
      }).EMAIL_PROVIDER,
    ).toBe("resend");
  });

  it("allows the Resend test sender in production so the app can start", () => {
    expect(
      parseEnvironment({
        ...productionEnvironment,
        EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "resend-test-key",
        RESEND_FROM: "onboarding@resend.dev",
      }).RESEND_FROM,
    ).toBe("onboarding@resend.dev");
  });

  it("requires Gmail API credentials when Gmail delivery is selected", () => {
    expect(() => parseEnvironment({ ...developmentEnvironment, EMAIL_PROVIDER: "gmail" })).toThrow(
      /GMAIL_CLIENT_ID/,
    );
    expect(
      parseEnvironment({
        ...developmentEnvironment,
        EMAIL_PROVIDER: "gmail",
        GMAIL_CLIENT_ID: "client",
        GMAIL_CLIENT_SECRET: "secret",
        GMAIL_REFRESH_TOKEN: "refresh",
        GMAIL_FROM: "sender@example.test",
      }).EMAIL_PROVIDER,
    ).toBe("gmail");
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
        SENDGRID_API_KEY: undefined,
      }),
    ).toThrow(/EMAIL_SMTP_HOST|EMAIL_SMTP_PORT|EMAIL_SMTP_USER|EMAIL_SMTP_PASSWORD/);
  });

  it("accepts complete SMTP configuration", () => {
    expect(
      parseEnvironment({
        ...productionEnvironment,
        EMAIL_PROVIDER: "smtp",
        SENDGRID_API_KEY: undefined,
        EMAIL_SMTP_HOST: "smtp.example.test",
        EMAIL_SMTP_PORT: "587",
        EMAIL_SMTP_USER: "mailer",
        EMAIL_SMTP_PASSWORD: "secret",
        SMTP_FROM: "sender@example.test",
      }),
    ).toMatchObject({ EMAIL_PROVIDER: "smtp", EMAIL_SMTP_PORT: 587 });
  });
});

describe("provider-specific configuration", () => {
  it.each([
    ["resend", "RESEND_API_KEY"],
    ["sendgrid", "SENDGRID_API_KEY"],
    ["mailgun", "MAILGUN_API_KEY"],
  ])("accepts a dedicated %s key and ignores blank fields for other providers", (provider, key) => {
    const config = {
      ...developmentEnvironment,
      EMAIL_PROVIDER: provider,
      [key]: "dedicated-key",
      EMAIL_SMTP_PORT: "",
      BREVO_FROM: "",
      [`${provider.toUpperCase()}_FROM`]: "sender@example.test",
      ...(provider === "mailgun" ? { EMAIL_MAILGUN_DOMAIN: "mg.example.test" } : {}),
    };
    expect(parseEnvironment(config).EMAIL_PROVIDER).toBe(provider);
  });
  it("does not use a different provider's dedicated key", () => {
    expect(() =>
      parseEnvironment({
        ...developmentEnvironment,
        EMAIL_PROVIDER: "sendgrid",
        RESEND_API_KEY: "resend-only",
      }),
    ).toThrow(/SENDGRID_API_KEY/);
  });
  it("requires the selected provider's sender", () => {
    expect(() =>
      parseEnvironment({
        ...developmentEnvironment,
        EMAIL_PROVIDER: "sendgrid",
        SENDGRID_API_KEY: "dedicated-key",
      }),
    ).toThrow(/SENDGRID_FROM/);
  });
});
