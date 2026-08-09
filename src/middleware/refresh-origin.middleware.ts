import type { RequestHandler } from "express";

import { env } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";

/** CSRF defense for refresh-token cookie endpoints. */
export const requireRefreshRequestOrigin: RequestHandler = (request, _response, next) => {
  if (request.header("Origin") !== env.WEB_APP_URL) {
    return next(new ApiError(403, "FORBIDDEN", "Request origin is not allowed."));
  }
  if (request.header("X-Requested-With") !== "XMLHttpRequest") {
    return next(new ApiError(403, "FORBIDDEN", "X-Requested-With header is required."));
  }
  return next();
};
