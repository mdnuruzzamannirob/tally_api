import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { DashboardController } from "./dashboard.controller.js";
import type { DashboardService } from "./dashboard.service.js";

export function createDashboardRouter(dashboardService: DashboardService): Router {
  const controller = new DashboardController(dashboardService);
  const router = Router();
  router.get(
    "/summary",
    authenticate,
    asyncHandler((request, response) => controller.summary(request, response)),
  );
  return router;
}
