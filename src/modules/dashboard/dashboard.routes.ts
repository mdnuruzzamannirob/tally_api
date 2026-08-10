import { Router } from "express";

import { authenticate } from "../../middleware/auth.middleware.js";
import { ApiError } from "../../utils/api-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { sendSuccess } from "../../utils/api-response.js";
import type { DashboardService } from "./dashboard.service.js";

export function createDashboardRouter(dashboardService: DashboardService): Router {
  const router = Router();
  router.get(
    "/summary",
    authenticate,
    asyncHandler(async (request, response) => {
      if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
      return sendSuccess(response, await dashboardService.getSummary(request.auth.userId));
    }),
  );
  return router;
}
