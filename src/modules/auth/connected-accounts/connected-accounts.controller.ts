import type { RequestHandler } from "express";

import { ApiError } from "../../../core/errors/api-error.js";
import { asyncHandler } from "../../../http/async-handler.js";
import { sendSuccess } from "../../../http/response/success-response.js";
import type { AuthService } from "../auth.service.js";
import { getOAuthCallbackUri } from "../oauth/oauth.constants.js";
import type { OAuthServices } from "../oauth/oauth.routes.js";
import type { OAuthProvider, OAuthProviderSlug } from "../oauth/oauth.types.js";

function getProvider(value: unknown): { id: OAuthProvider; slug: OAuthProviderSlug } {
  if (value === "google") return { id: "GOOGLE", slug: "google" };
  if (value === "github") return { id: "GITHUB", slug: "github" };
  throw new ApiError(400, "BAD_REQUEST", "Provider must be google or github.");
}

function requireUserId(request: Express.Request): string {
  if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
  return request.auth.userId;
}

export function createConnectedAccountsController(
  authService: AuthService,
  oauthServices: OAuthServices,
): {
  list: RequestHandler;
  startLink: RequestHandler;
  unlink: RequestHandler;
} {
  return {
    list: asyncHandler(async (request, response) =>
      sendSuccess(response, await authService.getConnectedAccounts(requireUserId(request))),
    ),
    startLink: asyncHandler(async (request, response) => {
      const userId = requireUserId(request);
      const provider = getProvider(request.params.provider);
      const authorizationUrl = await oauthServices[provider.slug].start(
        getOAuthCallbackUri(provider.slug),
        userId,
      );
      return sendSuccess(response, { authorizationUrl });
    }),
    unlink: asyncHandler(async (request, response) => {
      await authService.unlinkProvider(
        requireUserId(request),
        getProvider(request.params.provider).id,
      );
      return sendSuccess(response, { message: "Provider disconnected" });
    }),
  };
}
