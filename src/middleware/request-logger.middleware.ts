import { pinoHttp } from "pino-http";
import type { Request } from "express";

import { logger } from "../lib/logger.js";

export const requestLoggerMiddleware = pinoHttp({
  logger,
  customProps: (request) => ({
    requestId: (request as Request).requestId,
    requestMethod: request.method,
    requestPath: (request as Request).path,
  }),
});
