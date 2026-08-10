import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { ImportController } from "./import.controller.js";
import type { ImportService } from "./import.service.js";

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
