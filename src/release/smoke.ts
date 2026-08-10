export interface ReleaseSmokeOptions {
  apiBaseUrl: string;
  webAppUrl?: string;
  fetchImpl?: typeof fetch;
  createRequestId?: () => string;
}

export async function runReleaseSmoke({
  apiBaseUrl,
  webAppUrl,
  fetchImpl = fetch,
  createRequestId = () => `release-smoke-${crypto.randomUUID()}`,
}: ReleaseSmokeOptions): Promise<void> {
  const healthUrl = new URL("/api/v1/health", apiBaseUrl);
  const requestId = createRequestId();
  const response = await fetchImpl(healthUrl, {
    headers: {
      "X-Request-ID": requestId,
      ...(webAppUrl ? { Origin: webAppUrl } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Health check failed with HTTP ${response.status}.`);
  }

  const body: unknown = await response.json();
  if (
    !body ||
    typeof body !== "object" ||
    !("success" in body) ||
    body.success !== true ||
    !("data" in body) ||
    !body.data ||
    typeof body.data !== "object" ||
    !("status" in body.data) ||
    body.data.status !== "ok" ||
    !("database" in body.data) ||
    body.data.database !== "connected"
  ) {
    throw new Error("Health check returned an invalid response contract.");
  }

  if (response.headers.get("x-request-id") !== requestId) {
    throw new Error("Health check did not preserve the request ID.");
  }
  if (!response.headers.get("content-security-policy")) {
    throw new Error("Health check is missing the Content-Security-Policy header.");
  }
  if (response.headers.get("x-content-type-options") !== "nosniff") {
    throw new Error("Health check is missing the X-Content-Type-Options header.");
  }
  if (webAppUrl && response.headers.get("access-control-allow-origin") !== webAppUrl) {
    throw new Error("Health check did not return the configured CORS origin.");
  }
}
