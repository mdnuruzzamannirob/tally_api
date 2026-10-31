import type { EmailReceipt } from "../email.types.js";
import { setTimeout as delay } from "node:timers/promises";
import { logger } from "../../core/logger/logger.js";
import { ApiError } from "../../core/errors/api-error.js";

export function requireEmailApiKey(apiKey: string | undefined): string {
  if (!apiKey)
    throw new ApiError(503, "EMAIL_DELIVERY_FAILED", "Email delivery is currently unavailable.");
  return apiKey;
}

export function reportDeliveryFailure(
  provider: string,
  error: unknown,
  diagnostic: { status?: number; providerCode?: string } = {},
): never {
  logger.error(
    {
      event: "email_delivery_failed",
      provider,
      ...diagnostic,
      errorName: error instanceof Error ? error.name : "UnknownError",
    },
    "Email delivery failed",
  );
  throw new ApiError(
    503,
    "EMAIL_DELIVERY_FAILED",
    "Unable to send email right now. Please try again shortly.",
  );
}

export async function deliver(
  provider: string,
  url: string,
  init: RequestInit,
): Promise<EmailReceipt> {
  // Retrying ambiguous requests is safe only when the provider supports our idempotency key.
  const attempts = provider === "resend" ? 3 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, { method: "POST", ...init, signal: AbortSignal.timeout(10_000) });
    } catch (error) {
      if (attempt + 1 < attempts) {
        await delay(250 * 2 ** attempt);
        continue;
      }
      reportDeliveryFailure(provider, error);
    }
    const body = (await response.json().catch(() => null)) as {
      id?: unknown;
      name?: unknown;
      message?: unknown;
    } | null;
    if (response.ok && provider === "resend" && typeof body?.id !== "string") {
      if (attempt + 1 < attempts) {
        await delay(250 * 2 ** attempt);
        continue;
      }
      reportDeliveryFailure(provider, new Error("Invalid provider receipt"), {
        status: response.status,
        providerCode: "invalid_receipt",
      });
    }
    if (response.ok) {
      logger.info(
        {
          event: "email_accepted",
          provider,
          ...(typeof body?.id === "string" ? { providerMessageId: body.id } : {}),
        },
        "Email accepted by provider",
      );
      return typeof body?.id === "string" ? { id: body.id } : undefined;
    }
    if ((response.status === 429 || response.status >= 500) && attempt + 1 < attempts) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await delay(
        Math.min(
          5_000,
          Math.max(250 * 2 ** attempt, Number.isFinite(retryAfter) ? retryAfter * 1000 : 0),
        ),
      );
      continue;
    }
    // Store only a machine error name, never provider text containing addresses or tokens.
    const providerCode =
      typeof body?.name === "string" && /^[a-z_]{1,80}$/.test(body.name) ? body.name : undefined;
    reportDeliveryFailure(provider, new Error("Provider rejected email"), {
      status: response.status,
      ...(providerCode ? { providerCode } : {}),
    });
  }
}
