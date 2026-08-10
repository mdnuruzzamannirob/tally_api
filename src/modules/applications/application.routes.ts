import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { ApplicationController } from "./application.controller.js";
import type { ApplicationService } from "./application.service.js";

export function createApplicationsRouter(applicationService: ApplicationService): Router {
  const controller = new ApplicationController(applicationService);
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
  router.get(
    "/:id",
    authenticate,
    asyncHandler((request, response) => controller.getById(request, response)),
  );
  router.patch(
    "/:id",
    authenticate,
    asyncHandler((request, response) => controller.update(request, response)),
  );
  router.post(
    "/:id/status",
    authenticate,
    asyncHandler((request, response) => controller.changeStatus(request, response)),
  );
  router.get(
    "/:id/history",
    authenticate,
    asyncHandler((request, response) => controller.history(request, response)),
  );
  router.post(
    "/:id/archive",
    authenticate,
    asyncHandler((request, response) => controller.archive(request, response)),
  );
  router.post(
    "/:id/unarchive",
    authenticate,
    asyncHandler((request, response) => controller.unarchive(request, response)),
  );
  router.delete(
    "/:id",
    authenticate,
    asyncHandler((request, response) => controller.delete(request, response)),
  );
  return router;
}
