import type { Request, Response } from "express";
import { Router } from "express";

import { setRefreshCookie } from "../../../config/cookie.js";
import { env } from "../../../config/env.js";
import { logger } from "../../../lib/logger.js";
import type { GoogleOAuthService } from "./google-oauth.service.js";

export function getGoogleCallbackUri(_request: Request): string {
  void _request;
  return new URL("/api/v1/auth/google/callback", env.API_BASE_URL).toString();
}

function redirectToFrontend(
  response: Response,
  status: "success" | "error",
  intent?: "link",
): void {
  const url = new URL("/auth/social/callback", env.WEB_APP_URL);
  url.searchParams.set("status", status);
  if (intent) url.searchParams.set("intent", intent);
  response.redirect(url.toString());
}

export function createGoogleOAuthRouter(service: GoogleOAuthService): Router {
  const router = Router();
  router.get("/google", async (request, response) => {
    try {
      response.redirect(await service.start(getGoogleCallbackUri(request)));
    } catch {
      logger.warn({ event: "google_oauth_start_failed" }, "Google OAuth start failed");
      redirectToFrontend(response, "error");
    }
  });
  router.get("/google/callback", async (request, response) => {
    const code = typeof request.query.code === "string" ? request.query.code : undefined;
    const state = typeof request.query.state === "string" ? request.query.state : undefined;
    if (!code || !state) return redirectToFrontend(response, "error");
    try {
      const result = await service.complete(code, state, getGoogleCallbackUri(request));
      if (result.intent === "link") return redirectToFrontend(response, "success", "link");
      setRefreshCookie(response, result.refreshToken);
      return redirectToFrontend(response, "success");
    } catch {
      logger.warn({ event: "google_oauth_callback_failed" }, "Google OAuth callback failed");
      return redirectToFrontend(response, "error");
    }
  });
  return router;
}
