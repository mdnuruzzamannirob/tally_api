import { rateLimit, type RateLimitRequestHandler } from "express-rate-limit";

import { ApiError } from "../../../core/errors/api-error.js";

export function createRateLimit(windowMs: number, limit: number): RateLimitRequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_request, _response, next) =>
      next(new ApiError(429, "RATE_LIMITED", "Too many requests.")),
  });
}
