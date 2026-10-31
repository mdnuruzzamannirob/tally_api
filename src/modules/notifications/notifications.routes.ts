import { Router } from "express";
import { authenticate } from "../../http/middleware/auth.middleware.js";
import { asyncHandler } from "../../http/async-handler.js";
import { sendSuccess } from "../../http/response/success-response.js";
import type { NotificationService } from "./notifications.service.js";

export function createNotificationsRouter(service: NotificationService): Router {
  const router = Router();
  router.use(authenticate);
  router.get(
    "/",
    asyncHandler(async (request, response) =>
      sendSuccess(response, await service.list(request.auth!.userId)),
    ),
  );
  router.patch(
    "/read-all",
    asyncHandler(async (request, response) => {
      await service.markRead(request.auth!.userId);
      return sendSuccess(response, {});
    }),
  );
  router.patch(
    "/:id/read",
    asyncHandler(async (request, response) => {
      await service.markRead(request.auth!.userId, String(request.params.id));
      return sendSuccess(response, {});
    }),
  );
  return router;
}
