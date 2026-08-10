import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import { ApiError } from "../../utils/api-error.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRefreshRequestOrigin } from "../../middleware/refresh-origin.middleware.js";
import type { AuthService } from "./auth.service.js";
import { createAuthController } from "./auth.controller.js";

function createAuthRateLimit(windowMs: number, limit: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_request, _response, next) =>
      next(new ApiError(429, "RATE_LIMITED", "Too many requests.")),
  });
}

export function createAuthRouter(authService: AuthService): Router {
  const router = Router();
  const controller = createAuthController(authService);
  const authRateLimit = createAuthRateLimit(15 * 60 * 1_000, 10);
  const resendRateLimit = createAuthRateLimit(60 * 60 * 1_000, 5);

  router.post("/register", authRateLimit, controller.register);
  router.post("/login", authRateLimit, controller.login);
  router.post("/verify-email", authRateLimit, controller.verifyEmail);
  router.post("/resend-verification", resendRateLimit, controller.resendVerification);
  router.post("/refresh", authRateLimit, requireRefreshRequestOrigin, controller.refresh);
  router.post("/logout", authRateLimit, requireRefreshRequestOrigin, controller.logout);
  router.get("/me", authenticate, controller.me);

  return router;
}
