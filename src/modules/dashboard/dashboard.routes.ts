import { Router } from "express";

import { asyncHandler } from "../../http/async-handler.js";
import { authenticate } from "../../http/middleware/auth.middleware.js";
import { DashboardController } from "./dashboard.controller.js";
import type { DashboardService } from "./dashboard.service.js";

export function createDashboardRouter(dashboardService: DashboardService): Router {
  const controller = new DashboardController(dashboardService);
  const router = Router();
  const summaryHandler = asyncHandler((request, response) => controller.summary(request, response));
  router.get("/", authenticate, summaryHandler);
  router.get("/summary", authenticate, summaryHandler);
  return router;
}
