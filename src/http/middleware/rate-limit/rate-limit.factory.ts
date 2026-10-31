import { rateLimit, type RateLimitRequestHandler } from "express-rate-limit";

import { env } from "../../../core/config/env.js";
import { prisma } from "../../../core/database/prisma.js";
import { PostgresRateLimitStore } from "./postgres-rate-limit.store.js";
import { ApiError } from "../../../core/errors/api-error.js";

export function createRateLimit(
  windowMs: number,
  limit: number,
  options: { skipSuccessfulRequests?: boolean; bucket?: string } = {},
): RateLimitRequestHandler {
  const { bucket, ...rateOptions } = options;
  if (env.NODE_ENV === "production" && !bucket)
    throw new Error("A production rate limit bucket is required.");
  return rateLimit({
    windowMs,
    limit,
    ...rateOptions,
    ...(env.NODE_ENV === "production"
      ? { store: new PostgresRateLimitStore(prisma, bucket!) }
      : {}),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_request, _response, next) =>
      next(
        new ApiError(
          429,
          "RATE_LIMITED",
          "Too many requests. Please try again after the time indicated by Retry-After.",
        ),
      ),
  });
}
