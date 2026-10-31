import type { RequestHandler } from "express";

import { allowedFrontendOrigins } from "../../core/config/cors.config.js";
import { ApiError } from "../../core/errors/api-error.js";

/** CSRF defense for refresh-token cookie endpoints. */
export const requireRefreshRequestOrigin: RequestHandler = (request, _response, next) => {
  if (!allowedFrontendOrigins.has(request.header("Origin") ?? "")) {
    return next(new ApiError(403, "FORBIDDEN", "Request origin is not allowed."));
  }
  if (request.header("X-Requested-With") !== "XMLHttpRequest") {
    return next(new ApiError(403, "FORBIDDEN", "X-Requested-With header is required."));
  }
  return next();
};
