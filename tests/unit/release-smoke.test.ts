import { describe, expect, it, vi } from "vitest";

import { runReleaseSmoke } from "../../src/release/smoke.js";

function createResponse({
  status = 200,
  headers = {},
  body = { success: true, data: { status: "ok", database: "connected" } },
}: {
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
} = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

describe("release smoke test", () => {
  it("checks the health contract, security headers, request ID, and CORS", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      createResponse({
        headers: {
          "access-control-allow-origin": "https://preview.tally.example",
          "content-security-policy": "default-src 'self'",
          "x-content-type-options": "nosniff",
          "x-request-id": "smoke-request-id",
        },
      }),
    );

    await expect(
      runReleaseSmoke({
        apiBaseUrl: "https://api-preview.tally.example",
        webAppUrl: "https://preview.tally.example",
        fetchImpl,
        createRequestId: () => "smoke-request-id",
      }),
    ).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledWith(
      new URL("https://api-preview.tally.example/api/v1/health"),
      expect.objectContaining({
        headers: { "X-Request-ID": "smoke-request-id", Origin: "https://preview.tally.example" },
      }),
    );
  });

  it("fails safely when the health response is unhealthy", async () => {
    await expect(
      runReleaseSmoke({
        apiBaseUrl: "https://api-preview.tally.example",
        fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(createResponse({ status: 503 })),
      }),
    ).rejects.toThrow("Health check failed with HTTP 503.");
  });
});
