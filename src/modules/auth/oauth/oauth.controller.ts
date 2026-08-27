import type { RequestHandler } from "express";

import { setRefreshCookie } from "../../../core/config/cookie.config.js";
import { logger } from "../../../core/logger/logger.js";
import { getOAuthCallbackUri, getOAuthFrontendRedirect } from "./oauth.constants.js";
import type { OAuthService } from "./oauth.service.js";
import type { OAuthProviderSlug } from "./oauth.types.js";

export function createOAuthController(
  provider: OAuthProviderSlug,
  service: OAuthService,
): { start: RequestHandler; callback: RequestHandler } {
  return {
    start: async (_request, response) => {
      try {
        response.redirect(await service.start(getOAuthCallbackUri(provider)));
      } catch {
        logger.warn({ event: `${provider}_oauth_start_failed` }, "OAuth start failed");
        response.redirect(getOAuthFrontendRedirect("error"));
      }
    },
    callback: async (request, response) => {
      const code = typeof request.query.code === "string" ? request.query.code : undefined;
      const state = typeof request.query.state === "string" ? request.query.state : undefined;
      if (!code || !state) return response.redirect(getOAuthFrontendRedirect("error"));
      try {
        const result = await service.complete(code, state, getOAuthCallbackUri(provider));
        if (result.intent === "link") {
          return response.redirect(getOAuthFrontendRedirect("success", "link"));
        }
        setRefreshCookie(response, result.refreshToken, result.refreshTokenExpiresAt);
        return response.redirect(getOAuthFrontendRedirect("success"));
      } catch {
        logger.warn({ event: `${provider}_oauth_callback_failed` }, "OAuth callback failed");
        return response.redirect(getOAuthFrontendRedirect("error"));
      }
    },
  };
}
