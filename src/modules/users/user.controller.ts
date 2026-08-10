import type { RequestHandler } from "express";
import { ApiError } from "../../lib/api-error.js";
import { sendSuccess } from "../../lib/api-response.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { USER_AUTH_REQUIRED_MESSAGE } from "./user.constants.js";
import type { UserService } from "./user.service.js";
import { updatePreferencesSchema, updateProfileSchema } from "./user.validators.js";

export function createUserController(service: UserService): {
  updateProfile: RequestHandler;
  updatePreferences: RequestHandler;
} {
  const userId = (request: Express.Request) => {
    if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", USER_AUTH_REQUIRED_MESSAGE);
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
