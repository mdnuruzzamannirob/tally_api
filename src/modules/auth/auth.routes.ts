import { Router } from "express";

import { authenticate } from "../../http/middleware/auth.middleware.js";
import { createRateLimit } from "../../http/middleware/rate-limit/rate-limit.factory.js";
import { requireRefreshRequestOrigin } from "../../http/middleware/refresh-origin.middleware.js";
import type { AuthService } from "./auth.service.js";
import { createAuthController } from "./auth.controller.js";

export function createAuthRouter(authService: AuthService): Router {
  const router = Router();
  const controller = createAuthController(authService);
  // Each action owns its bucket. Session traffic cannot exhaust credential attempts.
  const windowMs = 15 * 60_000;
  const loginLimit = createRateLimit(windowMs, 10, {
    skipSuccessfulRequests: true,
    bucket: "login",
  });
  const registerLimit = createRateLimit(windowMs, 10, { bucket: "register" });
  const verifyLimit = createRateLimit(windowMs, 20, { bucket: "verify" });
  const resetLimit = createRateLimit(windowMs, 10, { bucket: "reset" });
  const resendLimit = createRateLimit(60 * 60_000, 5, { bucket: "resend" });
  const forgotLimit = createRateLimit(60 * 60_000, 5, { bucket: "forgot" });
  const refreshLimit = createRateLimit(windowMs, 120, { bucket: "refresh" });
  const logoutLimit = createRateLimit(windowMs, 30, { bucket: "logout" });
  const passwordLimit = createRateLimit(windowMs, 10, { bucket: "password" });

  router.post("/register", registerLimit, controller.register);
  router.post("/login", loginLimit, controller.login);
  router.post("/verify-email", verifyLimit, controller.verifyEmail);
  router.post("/resend-verification", resendLimit, controller.resendVerification);
  router.post("/refresh", requireRefreshRequestOrigin, refreshLimit, controller.refresh);
  router.post("/logout", requireRefreshRequestOrigin, logoutLimit, controller.logout);
  router.get("/me", authenticate, controller.me);
  router.post("/forgot-password", forgotLimit, controller.forgotPassword);
  router.post("/reset-password", resetLimit, controller.resetPassword);
  router.patch("/change-password", authenticate, passwordLimit, controller.changePassword);
  router.post("/set-password", authenticate, passwordLimit, controller.setPassword);

  return router;
}
