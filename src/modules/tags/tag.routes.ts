import { Router } from "express";

import { authenticate } from "../../middleware/auth.middleware.js";
import { ApiError } from "../../utils/api-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { sendSuccess } from "../../utils/api-response.js";
import type { TagService } from "./tag.service.js";
import { createTagSchema, updateTagSchema } from "./tag.validators.js";

function userIdOrThrow(request: Express.Request): string {
  if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
  return request.auth.userId;
}

export function createTagsRouter(tagService: TagService): Router {
  const router = Router();
  router.get(
    "/",
    authenticate,
    asyncHandler(async (request, response) =>
      sendSuccess(response, { tags: await tagService.list(userIdOrThrow(request)) }),
    ),
  );
  router.post(
    "/",
    authenticate,
    asyncHandler(async (request, response) => {
      const tag = await tagService.create(
        userIdOrThrow(request),
        createTagSchema.parse(request.body),
      );
      return sendSuccess(response, { tag }, 201);
    }),
  );
  router.patch(
    "/:id",
    authenticate,
    asyncHandler(async (request, response) => {
      if (typeof request.params.id !== "string" || !request.params.id)
        throw new ApiError(400, "BAD_REQUEST", "Tag ID is required.");
      const tag = await tagService.update(
        userIdOrThrow(request),
        request.params.id,
        updateTagSchema.parse(request.body),
      );
      return sendSuccess(response, { tag });
    }),
  );
  router.delete(
    "/:id",
    authenticate,
    asyncHandler(async (request, response) => {
      if (typeof request.params.id !== "string" || !request.params.id)
        throw new ApiError(400, "BAD_REQUEST", "Tag ID is required.");
      await tagService.delete(userIdOrThrow(request), request.params.id);
      return sendSuccess(response, { message: "Tag deleted" });
    }),
  );
  return router;
}
