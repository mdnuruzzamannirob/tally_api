import { Router } from "express";

import { authenticate } from "../../middleware/auth.middleware.js";
import type { GitHubOAuthService } from "../../oauth/github-oauth.service.js";
import type { GoogleOAuthService } from "../../oauth/google-oauth.service.js";
import { createConnectedAccountsController } from "./connected-accounts.controller.js";
import type { AuthService } from "./auth.service.js";

export function createConnectedAccountsRouter(
  authService: AuthService,
  googleOAuthService: GoogleOAuthService,
  githubOAuthService: GitHubOAuthService,
): Router {
  const router = Router();
  const controller = createConnectedAccountsController(
    authService,
    googleOAuthService,
    githubOAuthService,
  );
  router.get("/connected-accounts", authenticate, controller.list);
  router.post("/connected-accounts/:provider/link", authenticate, controller.startLink);
  router.delete("/connected-accounts/:provider", authenticate, controller.unlink);
  return router;
}
