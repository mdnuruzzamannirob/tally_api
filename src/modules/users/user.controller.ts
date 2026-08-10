import type { RequestHandler } from "express";
import { ApiError } from "../../lib/api-error.js";
import { sendSuccess } from "../../lib/api-response.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { updatePreferencesSchema, updateProfileSchema } from "../auth/auth.validators.js";
import type { UserService } from "./user.service.js";

export function createUserController(service: UserService): {
  updateProfile: RequestHandler;
  updatePreferences: RequestHandler;
} {
  const userId = (request: Express.Request) => {
    if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
    return request.auth.userId;
  };
  return {
    updateProfile: asyncHandler(async (request, response) =>
      sendSuccess(
        response,
        await service.updateProfile(userId(request), updateProfileSchema.parse(request.body)),
      ),
    ),
    updatePreferences: asyncHandler(async (request, response) =>
      sendSuccess(
        response,
        await service.updatePreferences(
          userId(request),
          updatePreferencesSchema.parse(request.body),
        ),
      ),
    ),
  };
}
