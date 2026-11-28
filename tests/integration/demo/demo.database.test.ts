import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../src/app.js";
import { env } from "../../../src/core/config/env.js";
import { prisma } from "../../../src/core/database/prisma.js";
import { createEmailProvider } from "../../../src/email/email.service.js";
import { clearTestDatabase } from "../../helpers/db.js";
import { DEMO_DOMAIN } from "../../../src/modules/demo/demo.fixture.js";
import { createDemoUser, resetDemoUser } from "../../../src/modules/demo/demo.repository.js";

describe.skipIf(!process.env.TEST_DATABASE_URL)("isolated demo lifecycle", () => {
  beforeEach(async () => {
    await clearTestDatabase(prisma);
    env.DEMO_MODE = true;
  });
  afterAll(async () => {
    env.DEMO_MODE = false;
    await clearTestDatabase(prisma);
    await prisma.$disconnect();
  });
  const app = () => createApp({ checkDatabase: async () => {} });
  const start = (server: ReturnType<typeof createApp>) =>
    request(server)
      .post("/api/v1/auth/demo")
      .set("Origin", env.WEB_APP_URL)
      .set("X-Requested-With", "XMLHttpRequest");

  it("restores the owner's edited fixture without changing another visitor's data", async () => {
    const a = await createDemoUser(`reset-a${DEMO_DOMAIN}`, "unused-test-hash");
    const b = await createDemoUser(`reset-b${DEMO_DOMAIN}`, "unused-test-hash");
    const original = await prisma.application.findFirstOrThrow({ where: { userId: a.id } });
    await prisma.note.create({ data: { applicationId: original.id, content: "Visitor edit" } });
    await prisma.application.update({
      where: { id: original.id },
      data: { company: "Visitor company" },
    });
    const otherBefore = await prisma.application.findMany({
      where: { userId: b.id },
      include: { notes: true, interviews: true },
    });
    await resetDemoUser(a.id);
    expect(await prisma.application.findUnique({ where: { id: original.id } })).toBeNull();
    expect(await prisma.application.count({ where: { userId: a.id } })).toBe(8);
    expect(await prisma.note.count({ where: { application: { userId: a.id } } })).toBe(8);
    expect(await prisma.note.count({ where: { content: "Visitor edit" } })).toBe(0);
    expect(
      await prisma.application.findMany({
        where: { userId: b.id },
        include: { notes: true, interviews: true },
      }),
    ).toEqual(otherBefore);
  });

  it("expires workspaces and cleans only stale demo identities on the next visit", async () => {
    const server = app();
    const visitor = (await start(server).expect(201)).body.data;
    const ordinary = await prisma.user.create({
      data: { email: "ordinary@example.test", createdAt: new Date(0) },
    });
    await prisma.user.update({
      where: { id: visitor.user.id },
      data: { createdAt: new Date(Date.now() - 25 * 60 * 60_000) },
    });
    await request(server)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${visitor.accessToken}`)
      .expect(401);
    await start(server).expect(201);
    expect(await prisma.user.findUnique({ where: { id: visitor.user.id } })).toBeNull();
    expect(await prisma.application.count({ where: { userId: visitor.user.id } })).toBe(0);
    expect(await prisma.user.findUnique({ where: { id: ordinary.id } })).not.toBeNull();
  });

  it("enforces a global capacity bound under concurrent creation without partial fixtures", async () => {
    await prisma.user.createMany({
      data: Array.from({ length: 99 }, (_, index) => ({
        email: `capacity-${index}${DEMO_DOMAIN}`,
      })),
    });
    const server = app();
    const replies = await Promise.all([start(server), start(server)]);
    expect(replies.map((reply) => reply.status).sort()).toEqual([201, 503]);
    expect(await prisma.user.count()).toBe(100);
    expect(await prisma.application.count()).toBe(8);
  });

  it("fails closed for delivery and exposes no demo entry in the normal application profile", async () => {
    await expect(
      createEmailProvider().send({
        to: "someone@example.test",
        subject: "Fixture",
        html: "Fixture",
      }),
    ).rejects.toThrow(/disabled/);
    env.DEMO_MODE = false;
    await start(app()).expect(404);
  });
});
