import { randomUUID } from "node:crypto";

import type { RequestHandler } from "express";

const requestIdPattern = /^[a-zA-Z0-9_-]{1,128}$/;

export const requestIdMiddleware: RequestHandler = (request, response, next) => {
  const suppliedRequestId = request.header("X-Request-ID");
  const requestId =
    suppliedRequestId && requestIdPattern.test(suppliedRequestId)
      ? suppliedRequestId
      : randomUUID();

  request.requestId = requestId;
  response.setHeader("X-Request-ID", requestId);
  next();
};
