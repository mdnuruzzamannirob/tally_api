import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../../src/app.js";
import { createAccessToken } from "../../../src/core/security/jwt.js";
import type { EmailService } from "../../../src/email/email.service.js";
import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { AuthRepository } from "../../../src/modules/auth/auth.repository.js";
import { AuthService } from "../../../src/modules/auth/auth.service.js";
import { InterviewService } from "../../../src/modules/interviews/interviews.service.js";
import { InterviewRepository } from "../../../src/modules/interviews/interviews.repository.js";
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

describe.skipIf(!runDatabaseTests)("interviews", () => {
  let prisma: PrismaClient;
  let app: Express;

  beforeAll(() => {
    prisma = createTestPrismaClient();
    app = createApp({
      checkDatabase: async () => undefined,
      authService: new AuthService(new AuthRepository(prisma), new TestEmailService()),
      interviewService: new InterviewService(new InterviewRepository(prisma)),
    });
  });

  beforeEach(async () => {
    await clearTestDatabase(prisma);
  });

  afterAll(async () => {
    await clearTestDatabase(prisma);
    await prisma.$disconnect();
  });

  it("creates, lists, updates, and deletes interviews without changing their application", async () => {
    const user = await prisma.user.create({ data: { email: "interviews@example.test" } });
    const application = await prisma.application.create({
      data: { userId: user.id, company: "Tally", role: "Engineer" },
    });
    const accessToken = createAccessToken({ sub: user.id, emailVerified: false });
    const scheduledAt = new Date(Date.now() + 86_400_000).toISOString();
    const created = await request(app)
      .post(`/api/v1/applications/${application.id}/interviews`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        type: "TECHNICAL",
        scheduledAt,
        interviewerName: "  Jane Smith  ",
        notes: "  Prepare design.  ",
      });
    expect(created.status).toBe(201);
    expect(created.body.data.interview).toMatchObject({
      type: "TECHNICAL",
      interviewerName: "Jane Smith",
      notes: "Prepare design.",
    });
    const interviewId = created.body.data.interview.id as string;

    const globalList = await request(app)
      .get("/api/v1/interviews?range=upcoming")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(globalList.body.data).toMatchObject({ pagination: { total: 1 } });
    const applicationList = await request(app)
      .get(`/api/v1/applications/${application.id}/interviews?range=upcoming`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(applicationList.body.data.items).toHaveLength(1);

    const updated = await request(app)
      .patch(`/api/v1/interviews/${interviewId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "COMPLETED", interviewerName: null });
    expect(updated.body.data.interview).toMatchObject({
      status: "COMPLETED",
      interviewerName: null,
      applicationId: application.id,
    });
    await request(app)
      .delete(`/api/v1/interviews/${interviewId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    await expect(prisma.interview.findUnique({ where: { id: interviewId } })).resolves.toBeNull();
  });

  it("filters archived interviews and prevents cross-user access", async () => {
    const user = await prisma.user.create({ data: { email: "interview-owner@example.test" } });
    const otherUser = await prisma.user.create({ data: { email: "interview-other@example.test" } });
    const archivedApplication = await prisma.application.create({
      data: { userId: user.id, company: "Archived", role: "Engineer", archivedAt: new Date() },
    });
    const privateApplication = await prisma.application.create({
      data: { userId: otherUser.id, company: "Private", role: "Engineer" },
    });
    const future = new Date(Date.now() + 86_400_000);
    await prisma.interview.create({
      data: { applicationId: archivedApplication.id, type: "HR", scheduledAt: future },
    });
    const privateInterview = await prisma.interview.create({
      data: { applicationId: privateApplication.id, type: "HR", scheduledAt: future },
    });
    const accessToken = createAccessToken({ sub: user.id, emailVerified: false });
    const excluded = await request(app)
      .get("/api/v1/interviews?range=upcoming")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(excluded.body.data.pagination.total).toBe(0);
    const included = await request(app)
      .get("/api/v1/interviews?range=upcoming&includeArchived=true")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(included.body.data.pagination.total).toBe(1);
    await request(app)
      .patch(`/api/v1/interviews/${privateInterview.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "COMPLETED" })
      .expect(404);
  });
});
