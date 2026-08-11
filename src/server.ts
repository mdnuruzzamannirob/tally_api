import { app } from "./app.js";
import { env } from "./core/config/env.js";
import { disconnectDatabase } from "./core/database/prisma.js";
import { logger } from "./core/logger/logger.js";

const port = env.PORT;
const shutdownTimeoutMs = 10_000;
const baseUrl = env.API_BASE_URL.replace(/\/$/, "");
const apiUrl = `${baseUrl}/api/v1`;
const healthUrl = `${apiUrl}/health`;
const docsUrl = `${apiUrl}/docs/`;
const openApiUrl = `${apiUrl}/openapi.json`;

const server = app.listen(port, () => {
  logger.info(
    {
      event: "server_started",
      port,
      nodeEnv: env.NODE_ENV,
      emailProvider: env.EMAIL_PROVIDER,
    },
    `Tally API ready • API: ${apiUrl} • Health: ${healthUrl} • Docs: ${docsUrl} • OpenAPI: ${openApiUrl}`,
  );
});

let isShuttingDown = false;

async function shutdown(reason: string, exitCode = 0): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ event: "server_shutdown_started", reason }, "Tally API shutting down");
  const forceExit = setTimeout(() => {
    logger.error(
      { event: "server_shutdown_timeout", timeoutMs: shutdownTimeoutMs },
      "Tally API shutdown timed out",
    );
    server.closeAllConnections();
    process.exit(1);
  }, shutdownTimeoutMs);
  forceExit.unref();

  server.close(async (error) => {
    if (error) {
      logger.error({ event: "server_close_failed", errorName: error.name }, "Server close failed");
      clearTimeout(forceExit);
      process.exit(1);
    }
    try {
      await disconnectDatabase();
      clearTimeout(forceExit);
      logger.info({ event: "server_shutdown_completed" }, "Tally API shutdown completed");
      process.exit(exitCode);
    } catch (disconnectError) {
      clearTimeout(forceExit);
      logger.error(
        {
          event: "database_disconnect_failed",
          errorName: disconnectError instanceof Error ? disconnectError.name : "UnknownError",
        },
        "Database disconnect failed",
      );
      process.exit(1);
    }
  });
}

logger.info(
  { event: "environment_validated", nodeEnv: env.NODE_ENV, emailProvider: env.EMAIL_PROVIDER },
  "Runtime environment validated",
);

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("uncaughtException", (error) => {
  logger.fatal({ event: "uncaught_exception", errorName: error.name }, "Uncaught exception");
  void shutdown("uncaughtException", 1);
});
process.once("unhandledRejection", (reason) => {
  logger.fatal(
    {
      event: "unhandled_rejection",
      errorName: reason instanceof Error ? reason.name : "UnknownError",
    },
    "Unhandled promise rejection",
  );
  void shutdown("unhandledRejection", 1);
});
