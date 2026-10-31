import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deliver } from "../../../src/email/providers/provider.utils.js";
import { ResendEmailProvider } from "../../../src/email/providers/resend.provider.js";
import { verifyWebhook } from "../../../src/email/webhook-verification.js";
import { emailConfig } from "../../../src/core/config/email.config.js";

vi.mock("../../../src/core/config/email.config.js", () => ({
  emailConfig: { apiKey: "test-key", from: "sender@example.test" },
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("email transport reliability", () => {
  it("retries a temporary failure with the same idempotency key", async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ name: "rate_limit_exceeded" }), { status: 429 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "email-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const result = new ResendEmailProvider().send({
      to: "recipient@example.test",
      subject: "Test",
      html: "Hello",
      idempotencyKey: "job-1",
    });
    await vi.runAllTimersAsync();
    await expect(result).resolves.toEqual({ id: "email-1" });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0]![1].headers["Idempotency-Key"]).toBe("job-1");
    expect(fetch.mock.calls[1]![1].headers["Idempotency-Key"]).toBe("job-1");
    expect(emailConfig.apiKey).toBe("test-key");
  });
  it("rejects malformed Resend success receipts after bounded retries", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockImplementation(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const result = expect(
      new ResendEmailProvider().send({ to: "test@example.test", subject: "Test", html: "Hello" }),
    ).rejects.toMatchObject({ code: "EMAIL_DELIVERY_FAILED" });
    await vi.runAllTimersAsync();
    await result;
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("does not retry permanent errors or leak provider details", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ name: "validation_error", message: "private recipient and token" }),
          { status: 403 },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(deliver("resend", "https://example.test", {})).rejects.toMatchObject({
      statusCode: 503,
      code: "EMAIL_DELIVERY_FAILED",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("does not retry an ambiguous failure for a provider without idempotency", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetch);
    await expect(deliver("sendgrid", "https://example.test", {})).rejects.toMatchObject({
      code: "EMAIL_DELIVERY_FAILED",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("Resend webhook signatures", () => {
  const secret = `whsec_${Buffer.from("webhook-test-secret").toString("base64")}`;
  const now = 1793420000000;
  const timestamp = String(Math.floor(now / 1000));
  const id = "msg_test";
  const payload = '{"type":"email.delivered"}';
  const signature = `v1,${createHmac("sha256", Buffer.from(secret.slice(6), "base64"))
    .update(`${id}.${timestamp}.${payload}`)
    .digest("base64")}`;
  it("accepts a valid signature, including rotated signatures", () => {
    expect(
      verifyWebhook(payload, { id, timestamp, signature: `v1,invalid ${signature}` }, secret, now),
    ).toBe(true);
  });
  it("rejects tampering, old messages and missing headers", () => {
    expect(verifyWebhook(`${payload} `, { id, timestamp, signature }, secret, now)).toBe(false);
    expect(verifyWebhook(payload, { id, timestamp, signature }, secret, now + 301000)).toBe(false);
    expect(verifyWebhook(payload, {}, secret, now)).toBe(false);
  });
});
