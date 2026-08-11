import type { RequestHandler } from "express";
import { ApiError } from "../../core/errors/api-error.js";
import { sendSuccess } from "../../http/response/success-response.js";
import { asyncHandler } from "../../http/async-handler.js";
import { USER_AUTH_REQUIRED_MESSAGE } from "./users.constants.js";
import type { UserService } from "./users.service.js";
import { updatePreferencesSchema, updateProfileSchema } from "./users.validators.js";

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
      sendSuccess(response, {
        user: await service.updateProfile(userId(request), updateProfileSchema.parse(request.body)),
      }),
    ),
    updatePreferences: asyncHandler(async (request, response) =>
      sendSuccess(response, {
        user: await service.updatePreferences(
          userId(request),
          updatePreferencesSchema.parse(request.body),
        ),
      }),
    ),
  };
}
