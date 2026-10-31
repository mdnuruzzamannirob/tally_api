import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmailService } from "../../../src/email/email.service.js";
import { BrevoEmailProvider } from "../../../src/email/providers/brevo.provider.js";
import { parseEnvironment } from "../../../src/core/config/env.schema.js";

vi.mock("../../../src/core/config/email.config.js", () => ({
  emailConfig: { provider: "brevo", brevoApiKey: "brevo-test-key", from: "sender@example.test" },
}));
afterEach(() => vi.unstubAllGlobals());

describe("Brevo transactional email", () => {
  it("sends the expected HTTP API request and returns Brevo's message ID", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ messageId: "<test-id@brevo.test>" }), { status: 201 }),
      );
    vi.stubGlobal("fetch", fetch);
    const result = await new BrevoEmailProvider().send({
      to: "other@example.test",
      subject: "Verify",
      html: "<p>Hello</p>",
    });
    expect(result).toEqual({ id: "<test-id@brevo.test>" });
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.headers["api-key"]).toBe("brevo-test-key");
    expect(JSON.parse(init.body)).toEqual({
      sender: { name: "Tally", email: "sender@example.test" },
      to: [{ email: "other@example.test" }],
      subject: "Verify",
      htmlContent: "<p>Hello</p>",
    });
  });

  it("uses Brevo for verification and password-reset messages", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(
        async () => new Response(JSON.stringify({ messageId: "message-id" }), { status: 201 }),
      );
    vi.stubGlobal("fetch", fetch);
    const service = createEmailService();
    await service.sendVerificationEmail({
      email: "other@example.test",
      token: "verification-token",
    });
    await service.sendPasswordResetEmail({ email: "other@example.test", token: "reset-token" });
    const verification = JSON.parse(fetch.mock.calls[0]![1].body);
    const reset = JSON.parse(fetch.mock.calls[1]![1].body);
    expect(verification.subject).toContain("Verify");
    expect(verification.htmlContent).toContain("verification-token");
    expect(reset.subject).toContain("Reset");
    expect(reset.htmlContent).toContain("reset-token");
  });

  it("reports provider rejection without leaking the response", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "unauthorized", message: "secret detail" }), {
        status: 401,
      }),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(
      new BrevoEmailProvider().send({ to: "other@example.test", subject: "Test", html: "Test" }),
    ).rejects.toMatchObject({ code: "EMAIL_DELIVERY_FAILED", statusCode: 503 });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("rejects a successful response without a message ID", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 201 })));
    await expect(
      new BrevoEmailProvider().send({ to: "other@example.test", subject: "Test", html: "Test" }),
    ).rejects.toMatchObject({ code: "EMAIL_DELIVERY_FAILED" });
  });

  it("requires a Brevo key separately from the previous Resend key", () => {
    const config = {
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://test:test@localhost/test",
      API_BASE_URL: "http://localhost:5000",
      WEB_APP_URL: "http://localhost:3000",
      ACCESS_TOKEN_SECRET: "test-secret",
      EMAIL_PROVIDER: "brevo",
      RESEND_API_KEY: "resend-key",
      BREVO_FROM: "sender@example.test",
    };
    expect(() => parseEnvironment(config)).toThrow(/BREVO_API_KEY/);
    expect(parseEnvironment({ ...config, BREVO_API_KEY: "brevo-key" }).EMAIL_PROVIDER).toBe(
      "brevo",
    );
  });
});
