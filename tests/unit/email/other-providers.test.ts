import { afterEach, describe, expect, it, vi } from "vitest";
import { SendGridEmailProvider } from "../../../src/email/providers/sendgrid.provider.js";
import { MailgunEmailProvider } from "../../../src/email/providers/mailgun.provider.js";
import { SmtpEmailProvider } from "../../../src/email/providers/smtp.provider.js";

const smtp = vi.hoisted(() => ({ sendMail: vi.fn(), createTransport: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: smtp.createTransport } }));
vi.mock("../../../src/core/config/email.config.js", () => ({
  emailConfig: {
    apiKey: "test-provider-key",
    from: "sender@example.test",
    mailgunDomain: "mg.example.test",
    smtp: {
      host: "smtp.example.test",
      port: 587,
      secure: false,
      user: "mailer",
      password: "test-password",
    },
  },
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
const message = { to: "recipient@example.test", subject: "Verify", html: "<p>Hello</p>" };

describe("other email delivery adapters", () => {
  it("sends a SendGrid request with the expected sender and recipient", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetch);
    await expect(new SendGridEmailProvider().send(message)).resolves.toBeUndefined();
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.sendgrid.com/v3/mail/send");
    expect(init.headers.Authorization).toBe("Bearer test-provider-key");
    expect(JSON.parse(init.body)).toMatchObject({
      from: { email: "sender@example.test" },
      personalizations: [{ to: [{ email: "recipient@example.test" }] }],
    });
  });
  it("sends a Mailgun request to the configured domain", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "mailgun-id" }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await expect(new MailgunEmailProvider().send(message)).resolves.toEqual({ id: "mailgun-id" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.mailgun.net/v3/mg.example.test/messages");
    expect(init.body.get("to")).toBe("recipient@example.test");
    expect(init.body.get("from")).toBe("sender@example.test");
  });
  it("uses SMTP transport with the selected connection settings", async () => {
    smtp.sendMail.mockResolvedValue({});
    smtp.createTransport.mockReturnValue({ sendMail: smtp.sendMail });
    await new SmtpEmailProvider().send(message);
    expect(smtp.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: "smtp.example.test", port: 587, secure: false }),
    );
    expect(smtp.sendMail).toHaveBeenCalledWith({ from: "sender@example.test", ...message });
  });
  it("returns a safe error on SMTP failure", async () => {
    smtp.sendMail.mockRejectedValue(new Error("sensitive server details"));
    smtp.createTransport.mockReturnValue({ sendMail: smtp.sendMail });
    await expect(new SmtpEmailProvider().send(message)).rejects.toMatchObject({
      statusCode: 503,
      code: "EMAIL_DELIVERY_FAILED",
    });
  });
});
