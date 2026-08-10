import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { Express } from "express";

import { env } from "./config/env.js";
import {
  ALLOWED_REQUEST_HEADERS,
  API_PREFIX,
  JSON_BODY_LIMIT,
  SUPPORTED_HTTP_METHODS,
} from "./config/constants.js";
import { logger } from "./lib/logger.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { notFoundMiddleware } from "./middleware/not-found.middleware.js";
import { requestIdMiddleware } from "./middleware/request-id.middleware.js";
import { appRouter, createApiRouter, type AppDependencies } from "./routes/index.js";

export type { AppDependencies } from "./routes/index.js";

export function createApp(overrides: AppDependencies = {}): Express {
  const app = express();
  const router = Object.keys(overrides).length ? createApiRouter(overrides) : appRouter;

  app.disable("x-powered-by");
  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      customProps: (request) => ({
        requestId: request.requestId,
        requestMethod: request.method,
        requestPath: request.path,
      }),
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: env.WEB_APP_URL,
      credentials: true,
      methods: SUPPORTED_HTTP_METHODS,
      allowedHeaders: ALLOWED_REQUEST_HEADERS,
    }),
  );
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(cookieParser());
  app.use(compression());

  app.use(API_PREFIX, router);
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}

export const app: Express = createApp();
