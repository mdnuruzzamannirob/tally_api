import { Router, type Request } from "express";

import { authenticate } from "../../middleware/auth.middleware.js";
import { ApiError } from "../../lib/api-error.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { sendSuccess } from "../../lib/api-response.js";
import type { TagService } from "./tag.service.js";
import { addApplicationTagsSchema } from "./tag.validators.js";

function userIdOrThrow(request: Request): string {
  if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
  return request.auth.userId;
}

function applicationIdOrThrow(request: Request): string {
  if (typeof request.params.id !== "string" || !request.params.id)
    throw new ApiError(400, "BAD_REQUEST", "Application ID is required.");
  return request.params.id;
}

export function createApplicationTagRouter(tagService: TagService): Router {
  const router = Router();
  router.post(
    "/:id/tags",
    authenticate,
    asyncHandler(async (request, response) => {
      const tags = await tagService.addToApplication(
        userIdOrThrow(request),
        applicationIdOrThrow(request),
        addApplicationTagsSchema.parse(request.body),
      );
      return sendSuccess(response, { tags });
    }),
  );
  router.delete(
    "/:id/tags/:tagId",
    authenticate,
    asyncHandler(async (request, response) => {
      if (typeof request.params.tagId !== "string" || !request.params.tagId)
        throw new ApiError(400, "BAD_REQUEST", "Tag ID is required.");
      await tagService.removeFromApplication(
        userIdOrThrow(request),
        applicationIdOrThrow(request),
        request.params.tagId,
      );
      return sendSuccess(response, { message: "Tag removed from application" });
    }),
  );
  return router;
}
