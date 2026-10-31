import { afterEach, describe, expect, it, vi } from "vitest";
import { GmailApiProvider } from "../../../src/email/providers/gmail-api.provider.js";

vi.mock("../../../src/core/config/email.config.js", () => ({
  emailConfig: {
    from: "sender@example.test",
    gmail: { clientId: "test-client", clientSecret: "test-secret", refreshToken: "test-refresh" },
  },
}));
afterEach(() => vi.unstubAllGlobals());
describe("Gmail API delivery", () => {
  it("uses HTTPS, sends a correctly encoded MIME message and reuses the access token", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token", expires_in: 3600 }), {
          status: 200,
        }),
      )
      .mockResolvedValue(new Response(JSON.stringify({ id: "gmail-message" }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const provider = new GmailApiProvider();
    const message = { to: "recipient@example.test", subject: "Verify", html: "<p>Hello</p>" };
    await expect(provider.send(message)).resolves.toEqual({ id: "gmail-message" });
    await provider.send(message);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[0]![0]).toBe("https://oauth2.googleapis.com/token");
    expect(fetch.mock.calls[1]![0]).toBe(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    );
    const payload = JSON.parse(fetch.mock.calls[1]![1].body);
    const mime = Buffer.from(payload.raw, "base64url").toString();
    expect(mime).toContain("recipient@example.test");
    expect(mime).toContain("Verify");
    expect(mime).toContain("<p>Hello</p>");
  });
  it("returns a safe error when refresh credentials are invalid", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_grant", details: "secret" }), {
        status: 400,
      }),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(
      new GmailApiProvider().send({ to: "recipient@example.test", subject: "Test", html: "Test" }),
    ).rejects.toMatchObject({ code: "EMAIL_DELIVERY_FAILED" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
