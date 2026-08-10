import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { ExportController } from "./export.controller.js";
import type { ExportService } from "./export.service.js";

export function createExportRouter(exportService: ExportService): Router {
  const controller = new ExportController(exportService);
  const router = Router();
  router.get(
    "/json",
    authenticate,
    asyncHandler((request, response) => controller.json(request, response)),
  );
  router.get(
    "/csv",
    authenticate,
    asyncHandler((request, response) => controller.csv(request, response)),
  );
  return router;
}
