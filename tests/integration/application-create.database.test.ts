import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { createAccessToken } from "../../src/auth/jwt.js";
import type { EmailService } from "../../src/email/email.service.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { ApplicationService } from "../../src/modules/applications/application.service.js";
import { AuthService } from "../../src/modules/auth/auth.service.js";
import { clearTestDatabase, createTestPrismaClient } from "../helpers/database.js";

const runDatabaseTests = Boolean(process.env.TEST_DATABASE_URL);

class TestEmailService implements EmailService {
  async sendVerificationEmail(_input: { email: string; token: string }): Promise<void> {
    void _input;
  }

  async sendPasswordResetEmail(_input: { email: string; token: string }): Promise<void> {
    void _input;
  }
}

describe.skipIf(!runDatabaseTests)("application creation and detail", () => {
  let prisma: PrismaClient;
  let app: Express;

  beforeAll(() => {
    prisma = createTestPrismaClient();
    app = createApp({
      checkDatabase: async () => undefined,
      authService: new AuthService(prisma, new TestEmailService()),
      applicationService: new ApplicationService(prisma),
    });
  });

  beforeEach(async () => {
    await clearTestDatabase(prisma);
  });

  afterAll(async () => {
    await clearTestDatabase(prisma);
    await prisma.$disconnect();
  });

  it("creates application children atomically and returns owned detail with tags", async () => {
    const user = await prisma.user.create({ data: { email: "applications@example.test" } });
    const tag = await prisma.tag.create({
      data: { userId: user.id, name: "priority", color: "#123456" },
    });
    const accessToken = createAccessToken({ sub: user.id, emailVerified: false });
    const created = await request(app)
      .post("/api/v1/applications")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        company: "  Tally  ",
        role: "  Engineer  ",
        status: "APPLIED",
        appliedAt: "2026-01-01",
        salaryMin: 80000,
        salaryMax: 100000,
        currency: "USD",
        nextFollowUpAt: "2026-01-10T09:00:00.000Z",
        tagIds: [tag.id],
        initialNote: "  Applied through careers page.  ",
      });
    expect(created.status).toBe(201);
    const applicationId = created.body.data.application.id as string;
    expect(created.body.data.application).toMatchObject({
      company: "Tally",
      role: "Engineer",
      status: "APPLIED",
    });
    expect(created.body.data.application.tags[0].tag).toMatchObject({
      id: tag.id,
      name: "priority",
    });
    await expect(prisma.note.findFirstOrThrow({ where: { applicationId } })).resolves.toMatchObject(
      { content: "Applied through careers page." },
    );
    await expect(
      prisma.statusHistory.findFirstOrThrow({ where: { applicationId } }),
    ).resolves.toMatchObject({ fromStatus: "WISHLIST", toStatus: "APPLIED" });

    const detail = await request(app)
      .get(`/api/v1/applications/${applicationId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.application.tags).toHaveLength(1);
  });

  it("rejects unowned tags and does not create a partial application", async () => {
    const user = await prisma.user.create({ data: { email: "owner@example.test" } });
    const otherUser = await prisma.user.create({ data: { email: "other@example.test" } });
    const otherTag = await prisma.tag.create({ data: { userId: otherUser.id, name: "private" } });
    const accessToken = createAccessToken({ sub: user.id, emailVerified: false });
    const response = await request(app)
      .post("/api/v1/applications")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ company: "Tally", role: "Engineer", tagIds: [otherTag.id] });
    expect(response.status).toBe(400);
    await expect(prisma.application.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("validates salary, date, and ownership rules", async () => {
    const user = await prisma.user.create({ data: { email: "validation@example.test" } });
    const otherUser = await prisma.user.create({ data: { email: "detail-other@example.test" } });
    const otherApplication = await prisma.application.create({
      data: { userId: otherUser.id, company: "Private", role: "Role" },
    });
    const accessToken = createAccessToken({ sub: user.id, emailVerified: false });
    await request(app)
      .post("/api/v1/applications")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ company: "Tally", role: "Engineer", salaryMin: 20, salaryMax: 10, currency: "USD" })
      .expect(400);
    await request(app)
      .post("/api/v1/applications")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ company: "Tally", role: "Engineer", appliedAt: "2026-02-31" })
      .expect(400);
    await request(app)
      .get(`/api/v1/applications/${otherApplication.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(404);
  });

  it("replaces tags transactionally, rejects generic status changes, and archives or deletes owned applications", async () => {
    const user = await prisma.user.create({ data: { email: "lifecycle@example.test" } });
    const firstTag = await prisma.tag.create({ data: { userId: user.id, name: "first" } });
    const secondTag = await prisma.tag.create({ data: { userId: user.id, name: "second" } });
    const application = await prisma.application.create({
      data: { userId: user.id, company: "Tally", role: "Engineer" },
    });
    await prisma.applicationTag.create({
      data: { applicationId: application.id, tagId: firstTag.id },
    });
    await prisma.note.create({ data: { applicationId: application.id, content: "A note" } });
    await prisma.statusHistory.create({
      data: { applicationId: application.id, fromStatus: "WISHLIST", toStatus: "APPLIED" },
    });
    const accessToken = createAccessToken({ sub: user.id, emailVerified: false });

    const updated = await request(app)
      .patch(`/api/v1/applications/${application.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ company: "Updated Tally", tagIds: [secondTag.id] });
    expect(updated.status).toBe(200);
    expect(updated.body.data.application.company).toBe("Updated Tally");
    expect(
      updated.body.data.application.tags.map((assignment: { tagId: string }) => assignment.tagId),
    ).toEqual([secondTag.id]);

    await request(app)
      .patch(`/api/v1/applications/${application.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "OFFER" })
      .expect(400);

    await request(app)
      .post(`/api/v1/applications/${application.id}/archive`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(
      (await prisma.application.findUniqueOrThrow({ where: { id: application.id } })).archivedAt,
    ).toBeInstanceOf(Date);
    await request(app)
      .post(`/api/v1/applications/${application.id}/unarchive`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(
      (await prisma.application.findUniqueOrThrow({ where: { id: application.id } })).archivedAt,
    ).toBeNull();

    await request(app)
      .delete(`/api/v1/applications/${application.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    await expect(
      prisma.application.findUnique({ where: { id: application.id } }),
    ).resolves.toBeNull();
    await expect(prisma.note.count({ where: { applicationId: application.id } })).resolves.toBe(0);
    await expect(
      prisma.statusHistory.count({ where: { applicationId: application.id } }),
    ).resolves.toBe(0);
  });
});
