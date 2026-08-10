import { Router } from "express";

import { authenticate } from "../../middleware/auth.middleware.js";
import { ApiError } from "../../lib/api-error.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { sendSuccess } from "../../lib/api-response.js";
import type { ImportService } from "./import.service.js";
import { importBackupSchema } from "./import.validators.js";

export function createImportRouter(importService: ImportService): Router {
  const router = Router();
  router.post(
    "/json",
    authenticate,
    asyncHandler(async (request, response) => {
      if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
      await importService.importJson(request.auth.userId, importBackupSchema.parse(request.body));
      return sendSuccess(response, { message: "Import completed" });
    }),
  );
  return router;
}
