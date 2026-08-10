import { Router } from "express";

import { authenticate } from "../../middleware/auth.middleware.js";
import { ApiError } from "../../utils/api-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import type { ExportService } from "./export.service.js";

export function createExportRouter(exportService: ExportService): Router {
  const router = Router();
  router.get(
    "/json",
    authenticate,
    asyncHandler(async (request, response) => {
      if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
      const backup = await exportService.exportJson(request.auth.userId);
      const date = new Date().toISOString().slice(0, 10);
      response.type("application/json");
      response.attachment(`tally-backup-${date}.json`);
      return response.send(backup);
    }),
  );
  router.get(
    "/csv",
    authenticate,
    asyncHandler(async (request, response) => {
      if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
      const csv = await exportService.exportCsv(request.auth.userId);
      const date = new Date().toISOString().slice(0, 10);
      response.type("text/csv");
      response.attachment(`tally-applications-${date}.csv`);
      return response.send(csv);
    }),
  );
  return router;
}
