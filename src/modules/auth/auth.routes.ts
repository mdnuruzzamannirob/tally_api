import { Router } from "express";

import { authenticate } from "../../http/middleware/auth.middleware.js";
import { authRateLimit } from "../../http/middleware/rate-limit/auth-rate-limit.middleware.js";
import { passwordResetRateLimit } from "../../http/middleware/rate-limit/password-reset-rate-limit.middleware.js";
import { resendVerificationRateLimit } from "../../http/middleware/rate-limit/resend-verification-rate-limit.middleware.js";
import { requireRefreshRequestOrigin } from "../../http/middleware/refresh-origin.middleware.js";
import type { AuthService } from "./auth.service.js";
import { createAuthController } from "./auth.controller.js";

export function createAuthRouter(authService: AuthService): Router {
  const router = Router();
  const controller = createAuthController(authService);

  router.post("/register", authRateLimit, controller.register);
  router.post("/login", authRateLimit, controller.login);
  router.post("/verify-email", authRateLimit, controller.verifyEmail);
  router.post("/resend-verification", resendVerificationRateLimit, controller.resendVerification);
  router.post("/refresh", authRateLimit, requireRefreshRequestOrigin, controller.refresh);
  router.post("/logout", authRateLimit, requireRefreshRequestOrigin, controller.logout);
  router.get("/me", authenticate, controller.me);
  router.post("/forgot-password", passwordResetRateLimit, controller.forgotPassword);
  router.post("/reset-password", authRateLimit, controller.resetPassword);
  router.patch("/change-password", authenticate, controller.changePassword);
  router.post("/set-password", authenticate, controller.setPassword);

  return router;
}
