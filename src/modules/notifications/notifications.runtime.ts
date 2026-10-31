import { prisma } from "../../core/database/prisma.js";
import { env } from "../../core/config/env.js";
import { logger } from "../../core/logger/logger.js";
import { createEmailProvider } from "../../email/email.service.js";
import { NotificationRepository } from "./notifications.repository.js";
import { NotificationService } from "./notifications.service.js";

export const notificationService = new NotificationService(
  new NotificationRepository(prisma),
  createEmailProvider(),
);

export function startNotificationWorker(): () => Promise<void> {
  if (!env.NOTIFICATION_WORKER_ENABLED) return async () => {};
  let active: Promise<void> | undefined;
  const tick = () => {
    if (active) return;
    active = notificationService
      .run()
      .catch((error: unknown) => {
        logger.error(
          {
            event: "notification_worker_failed",
            errorName: error instanceof Error ? error.name : "UnknownError",
          },
          "Notification worker failed",
        );
      })
      .finally(() => {
        active = undefined;
      });
  };
  const timer = setInterval(tick, 60_000);
  timer.unref();
  tick();
  return async () => {
    clearInterval(timer);
    await active;
  };
}
