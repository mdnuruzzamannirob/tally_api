import { createHmac } from "node:crypto";
import express from "express";
import request from "supertest";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../src/generated/prisma/client.js";
import { env } from "../../../src/core/config/env.js";
import { createAccessToken } from "../../../src/core/security/jwt.js";
import { errorMiddleware } from "../../../src/http/middleware/error-handler.middleware.js";
import { NotificationRepository } from "../../../src/modules/notifications/notifications.repository.js";
import { NotificationService } from "../../../src/modules/notifications/notifications.service.js";
import { createNotificationsRouter } from "../../../src/modules/notifications/notifications.routes.js";
import { EmailEventsRepository } from "../../../src/email/email-events.repository.js";
import { createEmailWebhookRouter } from "../../../src/email/email-webhook.routes.js";

const url = process.env.TEST_DATABASE_URL;
const suffix = `routes-${Date.now()}`;
let client: PrismaClient;
let userId: string;
let itemId: string;
let app: express.Express;
const previousSecret = env.RESEND_WEBHOOK_SECRET;
const secret = `whsec_${Buffer.from("test-signing-secret").toString("base64")}`;
describe.skipIf(!url)("notification HTTP and signed delivery events", () => {
  beforeAll(async () => {
    client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    userId = (await client.user.create({ data: { email: `${suffix}@example.test` } })).id;
    const repository = new NotificationRepository(client);
    itemId = (
      await repository.create({
        userId,
        eventKey: suffix,
        title: "Test",
        body: "Private account alert",
        href: "/settings",
      })
    ).id;
    env.RESEND_WEBHOOK_SECRET = secret;
    app = express();
    app.use("/webhooks", createEmailWebhookRouter(new EmailEventsRepository(client)));
    app.use(express.json());
    app.use(
      "/notifications",
      createNotificationsRouter(new NotificationService(repository, { send: async () => {} })),
    );
    app.use(errorMiddleware);
  });
  afterAll(async () => {
    if (previousSecret === undefined) delete env.RESEND_WEBHOOK_SECRET;
    else env.RESEND_WEBHOOK_SECRET = previousSecret;
    await client.user.delete({ where: { id: userId } });
    await client.emailDeliveryEvent.deleteMany({ where: { id: { startsWith: suffix } } });
    await client.$disconnect();
  });
  it("requires a session and prevents cross-account reads and writes", async () => {
    await request(app).get("/notifications").expect(401);
    const other = createAccessToken({ sub: "other-user", emailVerified: true });
    await request(app)
      .patch(`/notifications/${itemId}/read`)
      .auth(other, { type: "bearer" })
      .expect(200);
    expect(
      (await client.notification.findUniqueOrThrow({ where: { id: itemId } })).readAt,
    ).toBeNull();
    const own = createAccessToken({ sub: userId, emailVerified: true });
    const list = await request(app).get("/notifications").auth(own, { type: "bearer" }).expect(200);
    expect(list.body.data.unread).toBe(1);
    expect(list.body.data.items[0]).not.toHaveProperty("emailStatus");
    await request(app)
      .patch(`/notifications/${itemId}/read`)
      .auth(own, { type: "bearer" })
      .expect(200);
    expect(
      (await client.notification.findUniqueOrThrow({ where: { id: itemId } })).readAt,
    ).not.toBeNull();
  });
  it("accepts raw signed events once and rejects a modified payload", async () => {
    const payload = JSON.stringify({
      type: "email.delivered",
      created_at: new Date().toISOString(),
      data: { email_id: "email-test" },
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const id = `${suffix}-event`;
    const signature = `v1,${createHmac("sha256", Buffer.from(secret.slice(6), "base64"))
      .update(`${id}.${timestamp}.${payload}`)
      .digest("base64")}`;
    const send = (body: string) =>
      request(app)
        .post("/webhooks/resend")
        .set("Content-Type", "application/json")
        .set("svix-id", id)
        .set("svix-timestamp", timestamp)
        .set("svix-signature", signature)
        .send(body);
    await send(payload).expect(200);
    await send(payload).expect(200);
    expect(await client.emailDeliveryEvent.count({ where: { id } })).toBe(1);
    await send(`${payload} `).expect(400);
  });
});
