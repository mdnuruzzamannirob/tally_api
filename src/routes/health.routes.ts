import { Router } from "express";

import { asyncHandler } from "../lib/async-handler.js";
import { HealthController } from "./health.controller.js";
import type { HealthService } from "./health.service.js";

export function createHealthRouter(healthService: HealthService): Router {
  const controller = new HealthController(healthService);
  const router = Router();
  router.get(
    "/health",
    asyncHandler((request, response) => controller.status(request, response)),
  );
  return router;
}
