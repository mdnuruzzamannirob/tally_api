import { Router } from "express";

import { asyncHandler } from "../../http/async-handler.js";
import { authenticate } from "../../http/middleware/auth.middleware.js";
import { ExportController } from "./export.controller.js";
import type { ExportService } from "./export.service.js";
import { ImportController } from "./import.controller.js";
import type { ImportService } from "./import.service.js";

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

export function createImportRouter(importService: ImportService): Router {
  const controller = new ImportController(importService);
  const router = Router();
  router.post(
    "/json",
    authenticate,
    asyncHandler((request, response) => controller.json(request, response)),
  );
  return router;
}
