import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { TagController } from "./tag.controller.js";
import type { TagService } from "./tag.service.js";

export function createTagsRouter(tagService: TagService): Router {
  const controller = new TagController(tagService);
  const router = Router();
  router.get(
    "/",
    authenticate,
    asyncHandler((request, response) => controller.list(request, response)),
  );
  router.post(
    "/",
    authenticate,
    asyncHandler((request, response) => controller.create(request, response)),
  );
  router.patch(
    "/:id",
    authenticate,
    asyncHandler((request, response) => controller.update(request, response)),
  );
  router.delete(
    "/:id",
    authenticate,
    asyncHandler((request, response) => controller.delete(request, response)),
  );
  return router;
}
