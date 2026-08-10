import { rateLimit } from "express-rate-limit";

import { ApiError } from "../lib/api-error.js";

/** Baseline protection required for every versioned API route. */
export const globalApiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_request, _response, next) =>
    next(new ApiError(429, "RATE_LIMITED", "Too many requests.")),
});
