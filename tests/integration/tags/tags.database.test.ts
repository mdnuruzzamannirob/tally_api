import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../../src/app.js";
import { createAccessToken } from "../../../src/core/security/jwt.js";
import type { EmailService } from "../../../src/email/email.service.js";
import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { ApplicationService } from "../../../src/modules/applications/applications.service.js";
import { ApplicationRepository } from "../../../src/modules/applications/applications.repository.js";
import { AuthRepository } from "../../../src/modules/auth/auth.repository.js";
import { AuthService } from "../../../src/modules/auth/auth.service.js";
import { TagService } from "../../../src/modules/tags/tags.service.js";
import { TagRepository } from "../../../src/modules/tags/tags.repository.js";
import { clearTestDatabase, createTestPrismaClient } from "../../helpers/db.js";

const runDatabaseTests = Boolean(process.env.TEST_DATABASE_URL);

class TestEmailService implements EmailService {
  async sendVerificationEmail(_input: { email: string; token: string }): Promise<void> {
    void _input;
  }

  async sendPasswordResetEmail(_input: { email: string; token: string }): Promise<void> {
    void _input;
  }
}

describe.skipIf(!runDatabaseTests)("tags", () => {
  let prisma: PrismaClient;
  let app: Express;

  beforeAll(() => {
    prisma = createTestPrismaClient();
    app = createApp({
      checkDatabase: async () => undefined,
      authService: new AuthService(new AuthRepository(prisma), new TestEmailService()),
      applicationService: new ApplicationService(new ApplicationRepository(prisma)),
      tagService: new TagService(new TagRepository(prisma)),
    });
  });

  beforeEach(async () => {
    await clearTestDatabase(prisma);
  });

  afterAll(async () => {
    await clearTestDatabase(prisma);
    await prisma.$disconnect();
  });

  it("normalizes user tags and protects CRUD ownership", async () => {
    const user = await prisma.user.create({ data: { email: "tags@example.test" } });
    const otherUser = await prisma.user.create({ data: { email: "other-tags@example.test" } });
    const accessToken = createAccessToken({ sub: user.id, emailVerified: false });
    const created = await request(app)
      .post("/api/v1/tags")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "  Priority  ", color: "#6366f1" });
    expect(created.status).toBe(201);
    expect(created.body.data.tag).toMatchObject({ name: "priority", color: "#6366f1" });
    const tagId = created.body.data.tag.id as string;
    await request(app)
      .post("/api/v1/tags")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "PRIORITY" })
      .expect(409);

    const updated = await request(app)
      .patch(`/api/v1/tags/${tagId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "  Follow Up ", color: null });
    expect(updated.body.data.tag).toMatchObject({ name: "follow up", color: null });
    const list = await request(app)
      .get("/api/v1/tags")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(list.body.data.tags.map((tag: { name: string }) => tag.name)).toEqual(["follow up"]);

    const otherTag = await prisma.tag.create({ data: { userId: otherUser.id, name: "private" } });
    await request(app)
      .delete(`/api/v1/tags/${otherTag.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(404);
  });

  it("adds tags idempotently and removes assignments without deleting the application", async () => {
    const user = await prisma.user.create({ data: { email: "assignments@example.test" } });
    const otherUser = await prisma.user.create({
      data: { email: "assignment-other@example.test" },
    });
    const application = await prisma.application.create({
      data: { userId: user.id, company: "Tally", role: "Engineer" },
    });
    const tag = await prisma.tag.create({ data: { userId: user.id, name: "priority" } });
    const otherTag = await prisma.tag.create({ data: { userId: otherUser.id, name: "private" } });
    const accessToken = createAccessToken({ sub: user.id, emailVerified: false });

    const first = await request(app)
      .post(`/api/v1/applications/${application.id}/tags`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ tagIds: [tag.id] });
    expect(first.status).toBe(200);
    const replay = await request(app)
      .post(`/api/v1/applications/${application.id}/tags`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ tagIds: [tag.id] });
    expect(replay.status).toBe(200);
    await expect(
      prisma.applicationTag.count({ where: { applicationId: application.id } }),
    ).resolves.toBe(1);

    await request(app)
      .post(`/api/v1/applications/${application.id}/tags`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ tagIds: [otherTag.id] })
      .expect(400);
    await request(app)
      .delete(`/api/v1/applications/${application.id}/tags/${tag.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    await expect(
      prisma.applicationTag.count({ where: { applicationId: application.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.application.findUnique({ where: { id: application.id } }),
    ).resolves.not.toBeNull();
  });
});
