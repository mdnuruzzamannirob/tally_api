import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import type { Express } from "express";
import express from "express";
import helmet from "helmet";

import { API_PREFIX, JSON_BODY_LIMIT } from "./core/config/app.config.js";
import { corsOptions } from "./core/config/cors.config.js";
import { errorMiddleware } from "./http/middleware/error-handler.middleware.js";
import { notFoundMiddleware } from "./http/middleware/not-found.middleware.js";
import { requestIdMiddleware } from "./http/middleware/request-id.middleware.js";
import { requestLoggerMiddleware } from "./http/middleware/request-logger.middleware.js";
import { appRouter, createApiRouter, type AppDependencies } from "./routes/index.js";

export type { AppDependencies } from "./routes/index.js";

export function createApp(overrides: AppDependencies = {}): Express {
  const app = express();
  const router = Object.keys(overrides).length ? createApiRouter(overrides) : appRouter;

  app.disable("x-powered-by");
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(cookieParser());
  app.use(compression());

  app.use(API_PREFIX, router);
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}

export const app: Express = createApp();
