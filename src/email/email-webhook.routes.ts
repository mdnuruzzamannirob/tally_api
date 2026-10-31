import express, { type Router } from "express";
import { z } from "zod";
import { env } from "../core/config/env.js";
import { ApiError } from "../core/errors/api-error.js";
import { logger } from "../core/logger/logger.js";
import { sendSuccess } from "../http/response/success-response.js";
import { asyncHandler } from "../http/async-handler.js";
import type { EmailEventsRepository } from "./email-events.repository.js";
import { verifyWebhook } from "./webhook-verification.js";

const eventSchema = z.object({
  type: z.string().max(80),
  created_at: z.iso.datetime(),
  data: z.object({ email_id: z.string().min(1).max(200) }),
});
export function createEmailWebhookRouter(repository: EmailEventsRepository): Router {
  const router = express.Router();
  router.post(
    "/resend",
    express.raw({ type: "application/json", limit: "128kb" }),
    asyncHandler(async (request, response) => {
      if (!env.RESEND_WEBHOOK_SECRET)
        throw new ApiError(503, "SERVICE_UNAVAILABLE", "Webhook is not configured.");
      const payload = Buffer.isBuffer(request.body) ? request.body.toString("utf8") : "";
      const id = request.get("svix-id");
      if (
        !verifyWebhook(
          payload,
          {
            id,
            timestamp: request.get("svix-timestamp"),
            signature: request.get("svix-signature"),
          },
          env.RESEND_WEBHOOK_SECRET,
        )
      )
        throw new ApiError(400, "BAD_REQUEST", "Invalid webhook signature.");
      let event: unknown;
      try {
        event = JSON.parse(payload);
      } catch {
        throw new ApiError(400, "BAD_REQUEST", "Invalid webhook payload.");
      }
      const parsed = eventSchema.safeParse(event);
      if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", "Invalid email event.");
      await repository.record({
        id: id!,
        messageId: parsed.data.data.email_id,
        type: parsed.data.type,
        occurredAt: new Date(parsed.data.created_at),
      });
      logger.info(
        {
          event: "email_delivery_event",
          providerMessageId: parsed.data.data.email_id,
          type: parsed.data.type,
        },
        "Email delivery event received",
      );
      sendSuccess(response, {});
    }),
  );
  return router;
}
