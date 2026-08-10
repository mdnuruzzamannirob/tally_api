import { Router } from "express";

import { ApiError } from "../lib/api-error.js";
import { sendSuccess } from "../lib/api-response.js";
import { asyncHandler } from "../lib/async-handler.js";

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

      return sendSuccess(
        response,
        {
          status: "ok",
          database: "connected",
          timestamp: new Date().toISOString(),
        },
        { message: "Service is healthy." },
      );
    }),
  );

  return router;
}
