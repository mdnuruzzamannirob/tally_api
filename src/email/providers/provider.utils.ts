import { logger } from "../../core/logger/logger.js";

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
  throw new Error("Email delivery failed.");
}

export async function deliver(provider: string, url: string, init: RequestInit): Promise<void> {
  try {
    const response = await fetch(url, { method: "POST", ...init });
    if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
  } catch (error) {
    reportDeliveryFailure(provider, error);
  }
}
