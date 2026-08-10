import type { CookieOptions, Response } from "express";

import { env } from "./env.js";

export const REFRESH_COOKIE_NAME = "tally_rt";

export function durationToMilliseconds(duration: string): number {
  const match = /^(\d+)([smhdw])$/.exec(duration);
  if (!match) throw new Error("Invalid duration.");
  const multipliers = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
  return Number(match[1]) * multipliers[match[2] as keyof typeof multipliers];
}

export function getRefreshTokenExpiresAt(): Date {
  return new Date(Date.now() + durationToMilliseconds(env.REFRESH_TOKEN_EXPIRES_IN));
}

export function getRefreshCookieOptions(): CookieOptions {
  return { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: env.COOKIE_SAME_SITE, path: "/api/v1/auth", maxAge: durationToMilliseconds(env.REFRESH_TOKEN_EXPIRES_IN) };
}

export function setRefreshCookie(response: Response, token: string): Response {
  return response.cookie(REFRESH_COOKIE_NAME, token, getRefreshCookieOptions());
}

export function clearRefreshCookie(response: Response): Response {
  const { maxAge: _maxAge, ...options } = getRefreshCookieOptions();
  return response.clearCookie(REFRESH_COOKIE_NAME, options);
}
