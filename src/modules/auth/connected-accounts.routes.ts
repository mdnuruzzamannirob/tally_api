import { Router } from "express";

import { authenticate } from "../../middleware/auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { sendSuccess } from "../../utils/api-response.js";
import { getGitHubCallbackUri } from "../../oauth/github-oauth.routes.js";
import type { GitHubOAuthService } from "../../oauth/github-oauth.service.js";
import { getGoogleCallbackUri } from "../../oauth/google-oauth.routes.js";
import type { GoogleOAuthService } from "../../oauth/google-oauth.service.js";
import type { AuthService } from "./auth.service.js";

function getProvider(provider: unknown): "GOOGLE" | "GITHUB" {
  if (provider === "google") return "GOOGLE";
  if (provider === "github") return "GITHUB";
  throw new ApiError(400, "BAD_REQUEST", "Provider must be google or github.");
}

export function createConnectedAccountsRouter(
  authService: AuthService,
  googleOAuthService: GoogleOAuthService,
  githubOAuthService: GitHubOAuthService,
): Router {
  const router = Router();
  router.get(
    "/connected-accounts",
    authenticate,
    asyncHandler(async (request, response) => {
      if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
      return sendSuccess(response, await authService.getConnectedAccounts(request.auth.userId));
    }),
  );
  router.post(
    "/connected-accounts/:provider/link",
    authenticate,
    asyncHandler(async (request, response) => {
      if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
      const provider = getProvider(request.params.provider);
      const authorizationUrl =
        provider === "GOOGLE"
          ? await googleOAuthService.start(getGoogleCallbackUri(request), request.auth.userId)
          : await githubOAuthService.start(getGitHubCallbackUri(request), request.auth.userId);
      return sendSuccess(response, { authorizationUrl });
    }),
  );
  router.delete(
    "/connected-accounts/:provider",
    authenticate,
    asyncHandler(async (request, response) => {
      if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
      await authService.unlinkProvider(request.auth.userId, getProvider(request.params.provider));
      return sendSuccess(response, { message: "Provider disconnected" });
    }),
  );
  return router;
}
