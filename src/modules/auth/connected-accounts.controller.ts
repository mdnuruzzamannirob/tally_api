import type { RequestHandler } from "express";

import { ApiError } from "../../lib/api-error.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { sendSuccess } from "../../lib/api-response.js";
import { getGitHubCallbackUri } from "../../oauth/github-oauth.routes.js";
import type { GitHubOAuthService } from "../../oauth/github-oauth.service.js";
import { getGoogleCallbackUri } from "../../oauth/google-oauth.routes.js";
import type { GoogleOAuthService } from "../../oauth/google-oauth.service.js";
import type { AuthService } from "./auth.service.js";

type Provider = "GOOGLE" | "GITHUB";

function getProvider(provider: unknown): Provider {
  if (provider === "google") return "GOOGLE";
  if (provider === "github") return "GITHUB";
  throw new ApiError(400, "BAD_REQUEST", "Provider must be google or github.");
}

function requireUserId(request: Express.Request): string {
  if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
  return request.auth.userId;
}

export function createConnectedAccountsController(
  authService: AuthService,
  googleOAuthService: GoogleOAuthService,
  githubOAuthService: GitHubOAuthService,
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
      const authorizationUrl =
        provider === "GOOGLE"
          ? await googleOAuthService.start(getGoogleCallbackUri(request), userId)
          : await githubOAuthService.start(getGitHubCallbackUri(request), userId);
      return sendSuccess(response, { authorizationUrl });
    }),
    unlink: asyncHandler(async (request, response) => {
      await authService.unlinkProvider(
        requireUserId(request),
        getProvider(request.params.provider),
      );
      return sendSuccess(response, { message: "Provider disconnected" });
    }),
  };
}
