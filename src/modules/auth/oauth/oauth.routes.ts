import { Router } from "express";

import { createOAuthController } from "./oauth.controller.js";
import type { OAuthService } from "./oauth.service.js";
import type { OAuthProviderSlug } from "./oauth.types.js";

export type OAuthServices = Record<OAuthProviderSlug, OAuthService>;

function mountProvider(router: Router, provider: OAuthProviderSlug, service: OAuthService): void {
  const controller = createOAuthController(provider, service);
  router.get(`/${provider}`, controller.start);
  router.get(`/${provider}/callback`, controller.callback);
}

export function createOAuthRouter(services: OAuthServices): Router {
  const router = Router();
  mountProvider(router, "google", services.google);
  mountProvider(router, "github", services.github);
  return router;
}
