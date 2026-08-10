import type { RequestHandler } from "express";

import { ApiError } from "../lib/api-error.js";

export const notFoundMiddleware: RequestHandler = (request, _response, next) => {
  next(
    new ApiError(404, "NOT_FOUND", `Route ${request.method} ${request.originalUrl} was not found.`),
  );
};
