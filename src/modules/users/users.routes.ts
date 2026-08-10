import { Router } from "express";

import { authenticate } from "../../middleware/auth.middleware.js";
import { ApiError } from "../../lib/api-error.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { sendSuccess } from "../../lib/api-response.js";
import type { AuthService } from "../auth/auth.service.js";
import { updatePreferencesSchema, updateProfileSchema } from "../auth/auth.validators.js";

export function createUsersRouter(authService: AuthService): Router {
  const router = Router();
  router.patch(
    "/me/profile",
    authenticate,
    asyncHandler(async (request, response) => {
      if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
      const user = await authService.updateProfile(
        request.auth.userId,
        updateProfileSchema.parse(request.body),
      );
      return sendSuccess(response, { user });
    }),
  );
  router.patch(
    "/me/preferences",
    authenticate,
    asyncHandler(async (request, response) => {
      if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
      const user = await authService.updatePreferences(
        request.auth.userId,
        updatePreferencesSchema.parse(request.body),
      );
      return sendSuccess(response, { user });
    }),
  );
  return router;
}
