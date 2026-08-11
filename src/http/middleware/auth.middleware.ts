import type { RequestHandler } from "express";

import { ApiError } from "../../core/errors/api-error.js";
import {
  AccessTokenExpiredError,
  InvalidAccessTokenError,
  verifyAccessToken,
} from "../../core/security/jwt.js";

export const authenticate: RequestHandler = (request, _response, next) => {
  const authorization = request.header("Authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return next(new ApiError(401, "UNAUTHORIZED", "Authentication is required."));

  try {
    const payload = verifyAccessToken(match[1]);
    request.auth = { userId: payload.sub, emailVerified: payload.emailVerified };
    return next();
  } catch (error) {
    if (error instanceof AccessTokenExpiredError) {
      return next(new ApiError(401, "TOKEN_EXPIRED", "Access token has expired."));
    }
    if (error instanceof InvalidAccessTokenError) {
      return next(new ApiError(401, "UNAUTHORIZED", "Invalid access token."));
    }
    return next(error);
  }
};
