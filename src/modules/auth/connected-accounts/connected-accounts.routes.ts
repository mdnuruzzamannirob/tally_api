import { Router } from "express";

import { authenticate } from "../../../http/middleware/auth.middleware.js";
import type { AuthService } from "../auth.service.js";
import type { OAuthServices } from "../oauth/oauth.routes.js";
import { createConnectedAccountsController } from "./connected-accounts.controller.js";

export function createConnectedAccountsRouter(
  authService: AuthService,
  oauthServices: OAuthServices,
): Router {
  const router = Router();
  const controller = createConnectedAccountsController(authService, oauthServices);
  router.get("/connected-accounts", authenticate, controller.list);
  router.post("/connected-accounts/:provider/link", authenticate, controller.startLink);
  router.delete("/connected-accounts/:provider", authenticate, controller.unlink);
  return router;
}
