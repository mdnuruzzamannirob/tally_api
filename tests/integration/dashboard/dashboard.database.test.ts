import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../../src/app.js";
import { createAccessToken } from "../../../src/core/security/jwt.js";
import { DashboardService } from "../../../src/modules/dashboard/dashboard.service.js";
import { DashboardRepository } from "../../../src/modules/dashboard/dashboard.repository.js";
import type { EmailService } from "../../../src/email/email.service.js";
import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { AuthRepository } from "../../../src/modules/auth/auth.repository.js";
import { AuthService } from "../../../src/modules/auth/auth.service.js";
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

describe.skipIf(!runDatabaseTests)("dashboard", () => {
  let prisma: PrismaClient;
  let app: Express;

  beforeAll(() => {
    prisma = createTestPrismaClient();
    app = createApp({
      checkDatabase: async () => undefined,
      authService: new AuthService(new AuthRepository(prisma), new TestEmailService()),
      dashboardService: new DashboardService(new DashboardRepository(prisma)),
    });
  });

  beforeEach(async () => {
    await clearTestDatabase(prisma);
  });

  afterAll(async () => {
    await clearTestDatabase(prisma);
    await prisma.$disconnect();
  });

  it("returns archived-safe user metrics and compact dashboard lists", async () => {
    const user = await prisma.user.create({
      data: { email: "dashboard@example.test", timeZone: "UTC" },
    });
    const otherUser = await prisma.user.create({ data: { email: "dashboard-other@example.test" } });
    const now = Date.now();
    const overdue = await prisma.application.create({
      data: {
        userId: user.id,
        company: "Overdue",
        role: "Engineer",
        status: "APPLIED",
        nextFollowUpAt: new Date(now - 86_400_000),
      },
    });
    const today = await prisma.application.create({
      data: {
        userId: user.id,
        company: "Today",
        role: "Designer",
        status: "INTERVIEW",
        nextFollowUpAt: new Date(now),
      },
    });
    const offer = await prisma.application.create({
      data: { userId: user.id, company: "Offer", role: "Engineer", status: "OFFER" },
    });
    const archived = await prisma.application.create({
      data: {
        userId: user.id,
        company: "Archived",
        role: "Engineer",
        status: "APPLIED",
        archivedAt: new Date(),
        nextFollowUpAt: new Date(now - 86_400_000),
      },
    });
    await prisma.application.create({
      data: { userId: otherUser.id, company: "Other", role: "Engineer", status: "OFFER" },
    });
    await prisma.interview.create({
      data: {
        applicationId: today.id,
        type: "TECHNICAL",
        status: "SCHEDULED",
        scheduledAt: new Date(now + 86_400_000),
      },
    });
    await prisma.interview.create({
      data: {
        applicationId: archived.id,
        type: "HR",
        status: "SCHEDULED",
        scheduledAt: new Date(now + 86_400_000),
      },
    });
    await prisma.interview.create({
      data: {
        applicationId: offer.id,
        type: "HR",
        status: "COMPLETED",
        scheduledAt: new Date(now + 86_400_000),
      },
    });
    const accessToken = createAccessToken({ sub: user.id, emailVerified: false });

    const response = await request(app)
      .get("/api/v1/dashboard/summary")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      totalApplications: 3,
      activeApplications: 2,
      offers: 1,
      scheduledInterviews: 1,
    });
    expect(response.body.data.statusCounts).toMatchObject({
      APPLIED: 1,
      INTERVIEW: 1,
      OFFER: 1,
      WISHLIST: 0,
    });
    expect(response.body.data.followUps).toMatchObject({ overdueCount: 1, todayCount: 1 });
    expect(response.body.data.followUps.overdue.map((item: { id: string }) => item.id)).toEqual([
      overdue.id,
    ]);
    expect(response.body.data.upcomingInterviews).toHaveLength(1);
    expect(response.body.data.recentApplications).toHaveLength(3);
  });
});
