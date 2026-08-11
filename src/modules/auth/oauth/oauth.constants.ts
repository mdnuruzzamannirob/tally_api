import { env } from "../../../core/config/env.js";
import type { OAuthProviderSlug } from "./oauth.types.js";

export function getOAuthCallbackUri(provider: OAuthProviderSlug): string {
  return new URL(`/api/v1/auth/${provider}/callback`, env.API_BASE_URL).toString();
}

export function getOAuthFrontendRedirect(status: "success" | "error", intent?: "link"): string {
  const url = new URL("/auth/social/callback", env.WEB_APP_URL);
  url.searchParams.set("status", status);
  if (intent) url.searchParams.set("intent", intent);
  return url.toString();
}
