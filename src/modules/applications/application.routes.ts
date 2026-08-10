import { Router } from "express";

import { authenticate } from "../../middleware/auth.middleware.js";
import { ApiError } from "../../utils/api-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { sendSuccess } from "../../utils/api-response.js";
import type { ApplicationService } from "./application.service.js";
import { createApplicationSchema } from "./application.validators.js";

function userIdOrThrow(request: Express.Request): string {
  if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
  return request.auth.userId;
}

export function createApplicationsRouter(applicationService: ApplicationService): Router {
  const router = Router();
  router.post(
    "/",
    authenticate,
    asyncHandler(async (request, response) => {
      const application = await applicationService.create(
        userIdOrThrow(request),
        createApplicationSchema.parse(request.body),
      );
      return sendSuccess(response, { application }, 201);
    }),
  );
  router.get(
    "/:id",
    authenticate,
    asyncHandler(async (request, response) => {
      if (typeof request.params.id !== "string" || !request.params.id) {
        throw new ApiError(400, "BAD_REQUEST", "Application ID is required.");
      }
      return sendSuccess(response, {
        application: await applicationService.getById(userIdOrThrow(request), request.params.id),
      });
    }),
  );
  return router;
}
