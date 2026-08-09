import { Router } from "express";

import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../utils/api-response.js";

export function createHealthRouter(checkDatabase: () => Promise<void>): Router {
  const router = Router();

  router.get(
    "/health",
    asyncHandler(async (_request, response) => {
      try {
        await checkDatabase();
      } catch {
        throw new ApiError(503, "SERVICE_UNAVAILABLE", "Service temporarily unavailable.");
      }

      return sendSuccess(response, {
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString(),
      });
    }),
  );

  return router;
}
