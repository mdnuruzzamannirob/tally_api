import { logger } from "../../core/logger/logger.js";
import { ApiError } from "../../core/errors/api-error.js";

export function requireEmailApiKey(apiKey: string | undefined): string {
  if (!apiKey) throw new Error("Email provider credentials are not configured.");
  return apiKey;
}

export function reportDeliveryFailure(provider: string, error: unknown): never {
  logger.error(
    {
      event: "email_delivery_failed",
      provider,
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

export async function deliver(provider: string, url: string, init: RequestInit): Promise<void> {
  try {
    const response = await fetch(url, { method: "POST", ...init });
    if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
  } catch (error) {
    reportDeliveryFailure(provider, error);
  }
}
