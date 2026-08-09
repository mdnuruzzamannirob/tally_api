import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { Express } from "express";

import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { notFoundMiddleware } from "./middleware/not-found.middleware.js";
import { requestIdMiddleware } from "./middleware/request-id.middleware.js";
import { createHealthRouter } from "./routes/health.routes.js";

export interface AppDependencies {
  checkDatabase?: () => Promise<void>;
}

const defaultDatabaseCheck = async (): Promise<void> => {
  const { prisma } = await import("./lib/prisma.js");
  await prisma.$queryRaw`SELECT 1`;
};

export function createApp({ checkDatabase = defaultDatabaseCheck }: AppDependencies = {}): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      customProps: (request) => ({ requestId: request.requestId }),
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: env.WEB_APP_URL,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(compression());

  app.use("/api/v1", createHealthRouter(checkDatabase));
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}

export const app: Express = createApp();
