import { afterEach, describe, expect, it, vi } from "vitest";

const base = {
  EMAIL_PROVIDER: "brevo",
  BREVO_API_KEY: "brevo-secret",
  RESEND_API_KEY: "resend-secret",
  SENDGRID_API_KEY: "sendgrid-secret",
  MAILGUN_API_KEY: "mailgun-secret",
  BREVO_FROM: "brevo@example.test",
  RESEND_FROM: "resend@example.test",
  SENDGRID_FROM: "sendgrid@example.test",
  MAILGUN_FROM: "mailgun@example.test",
  GMAIL_FROM: "gmail@example.test",
  SMTP_FROM: "smtp@example.test",
};
afterEach(() => {
  vi.doUnmock("../../../src/core/config/env.js");
  vi.resetModules();
});
describe("email provider selection", () => {
  it.each([
    ["brevo", "brevo@example.test", undefined],
    ["resend", "resend@example.test", "resend-secret"],
    ["sendgrid", "sendgrid@example.test", "sendgrid-secret"],
    ["mailgun", "mailgun@example.test", "mailgun-secret"],
    ["gmail", "gmail@example.test", undefined],
    ["smtp", "smtp@example.test", undefined],
  ])("selects only the configured %s sender and API key", async (provider, sender, key) => {
    vi.resetModules();
    vi.doMock("../../../src/core/config/env.js", () => ({
      env: { ...base, EMAIL_PROVIDER: provider },
    }));
    const { emailConfig } = await import("../../../src/core/config/email.config.js");
    expect(emailConfig.from).toBe(sender);
    expect(emailConfig.apiKey).toBe(key);
    if (provider === "brevo") expect(emailConfig.brevoApiKey).toBe("brevo-secret");
  });
});
