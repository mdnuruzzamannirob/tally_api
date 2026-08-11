import { Router } from "express";

import { asyncHandler } from "../../http/async-handler.js";
import { authenticate } from "../../http/middleware/auth.middleware.js";
import { TagController } from "./tags.controller.js";
import type { TagService } from "./tags.service.js";

export function createApplicationTagRouter(tagService: TagService): Router {
  const controller = new TagController(tagService);
  const router = Router();
  router.post(
    "/:id/tags",
    authenticate,
    asyncHandler((request, response) => controller.addToApplication(request, response)),
  );
  router.delete(
    "/:id/tags/:tagId",
    authenticate,
    asyncHandler((request, response) => controller.removeFromApplication(request, response)),
  );
  return router;
}
