import type { RequestHandler } from "express";

import { ApiError } from "../lib/api-error.js";

export const requireVerifiedUser: RequestHandler = (request, _response, next) => {
  if (!request.auth) return next(new ApiError(401, "UNAUTHORIZED", "Authentication is required."));
  if (!request.auth.emailVerified) {
    return next(new ApiError(403, "EMAIL_NOT_VERIFIED", "Email verification is required."));
  }
  return next();
};
