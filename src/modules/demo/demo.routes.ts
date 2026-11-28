import { randomBytes, randomUUID } from "node:crypto";
import { Router, type RequestHandler } from "express";

import { createDemoUser, deleteDemoUser, findDemoUser, resetDemoUser } from "./demo.repository.js";
import { ApiError } from "../../core/errors/api-error.js";
import { hashPassword } from "../../core/security/password.js";
import { setRefreshCookie } from "../../core/config/cookie.config.js";
import { authenticate } from "../../http/middleware/auth.middleware.js";
import { requireRefreshRequestOrigin } from "../../http/middleware/refresh-origin.middleware.js";
import { createRateLimit } from "../../http/middleware/rate-limit/rate-limit.factory.js";
import { asyncHandler } from "../../http/async-handler.js";
import { sendSuccess } from "../../http/response/success-response.js";
import type { AuthService } from "../auth/auth.service.js";
import { DEMO_DOMAIN, DEMO_LIFETIME_MS } from "./demo.fixture.js";

const requireDemoUser: RequestHandler = asyncHandler(async (request, _response, next) => {
  const user = await findDemoUser(request.auth!.userId);
  if (
    !user?.email.endsWith(DEMO_DOMAIN) ||
    user.createdAt.getTime() < Date.now() - DEMO_LIFETIME_MS
  ) {
    throw new ApiError(401, "UNAUTHORIZED", "This demo workspace has expired. Start a new demo.");
  }
  next();
});

/** Mounted only in the separate demo profile, before normal account routes. */
export const demoBoundary: RequestHandler = (request, response, next) => {
  const path = request.path.toLowerCase().replace(/\/+$/, "");
  if (["/auth/refresh", "/auth/logout"].includes(path) && request.method === "POST") return next();
  if (path.startsWith("/auth/") && !(path === "/auth/me" && request.method === "GET")) {
    return next(
      new ApiError(
        403,
        "DEMO_RESTRICTED",
        "Account security and email actions are unavailable in the demo.",
      ),
    );
  }
  if (path === "/users/me/profile" || path.startsWith("/email/")) {
    return next(new ApiError(403, "DEMO_RESTRICTED", "Profile identity is fixed in the demo."));
  }
  authenticate(request, response, (error?: unknown) => {
    if (error) return next(error);
    void requireDemoUser(request, response, next);
  });
};

export function createDemoRouter(auth: AuthService): Router {
  const router = Router();
  router.post(
    "/auth/demo",
    requireRefreshRequestOrigin,
    createRateLimit(60 * 60_000, 10, { bucket: "demo-create" }),
    asyncHandler(async (request, response) => {
      const password = randomBytes(32).toString("hex");
      const passwordHash = await hashPassword(password);
      const email = `${randomUUID()}${DEMO_DOMAIN}`;
      const user = await createDemoUser(email, passwordHash);
      try {
        const session = await auth.login(
          { email, password },
          { ip: request.ip, userAgent: request.header("User-Agent") },
        );
        setRefreshCookie(response, session.refreshToken);
        return sendSuccess(
          response,
          { accessToken: session.accessToken, user: session.user },
          { statusCode: 201 },
        );
      } catch (error) {
        await deleteDemoUser(user.id);
        throw error;
      }
    }),
  );
  router.post(
    "/auth/demo/reset",
    requireRefreshRequestOrigin,
    authenticate,
    requireDemoUser,
    createRateLimit(60 * 60_000, 20, { bucket: "demo-reset" }),
    asyncHandler(async (request, response) => {
      await resetDemoUser(request.auth!.userId);
      return sendSuccess(response, {}, { message: "Your sample workspace has been restored." });
    }),
  );
  return router;
}
