import { env } from "../core/config/env.js";

export function buildVerificationUrl(token: string): string {
  const url = new URL("/verify-email", env.WEB_APP_URL);
  url.searchParams.set("token", token);
  return url.toString();
}

export function buildPasswordResetUrl(token: string): string {
  const url = new URL("/reset-password", env.WEB_APP_URL);
  url.searchParams.set("token", token);
  return url.toString();
}
