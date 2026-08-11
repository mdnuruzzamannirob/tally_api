import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../../src/app.js";
import { createAccessToken } from "../../../src/core/security/jwt.js";
import type { EmailService } from "../../../src/email/email.service.js";
import { ExportService } from "../../../src/modules/export-import/export.service.js";
import { ExportRepository } from "../../../src/modules/export-import/export-import.repository.js";
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

function keysIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysIn);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [key, ...keysIn(child)]);
}

describe.skipIf(!runDatabaseTests)("JSON export", () => {
  let prisma: PrismaClient;
  let app: Express;

  beforeAll(() => {
    prisma = createTestPrismaClient();
    app = createApp({
      checkDatabase: async () => undefined,
      authService: new AuthService(new AuthRepository(prisma), new TestEmailService()),
      exportService: new ExportService(new ExportRepository(prisma)),
    });
  });

  beforeEach(async () => {
    await clearTestDatabase(prisma);
  });

  afterAll(async () => {
    await clearTestDatabase(prisma);
    await prisma.$disconnect();
  });

  it("exports portable records with local references and no account credentials or database IDs", async () => {
    const user = await prisma.user.create({
      data: {
        email: "export@example.test",
        passwordHash: "nonportable-password-hash",
        name: "Export User",
        theme: "DARK",
        defaultLandingPage: "APPLICATIONS",
        timeZone: "Asia/Dhaka",
        notificationsEnabled: true,
      },
    });
    const tag = await prisma.tag.create({
      data: { userId: user.id, name: "priority", color: "#123456" },
    });
    const application = await prisma.application.create({
      data: {
        userId: user.id,
        company: "Tally",
        role: "Engineer",
        status: "APPLIED",
        salaryMin: 100,
        salaryMax: 200,
        currency: "USD",
      },
    });
    await prisma.applicationTag.create({ data: { applicationId: application.id, tagId: tag.id } });
    await prisma.note.create({ data: { applicationId: application.id, content: "Export note" } });
    await prisma.interview.create({
      data: {
        applicationId: application.id,
        type: "TECHNICAL",
        scheduledAt: new Date(),
        status: "SCHEDULED",
      },
    });
    await prisma.statusHistory.create({
      data: { applicationId: application.id, fromStatus: "WISHLIST", toStatus: "APPLIED" },
    });
    const accessToken = createAccessToken({ sub: user.id, emailVerified: false });

    const response = await request(app)
      .get("/api/v1/export/json")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.headers["content-disposition"]).toMatch(
      /^attachment; filename="tally-backup-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    expect(response.body).toMatchObject({
      version: 1,
      profile: { name: "Export User", preferences: { theme: "DARK", timeZone: "Asia/Dhaka" } },
      tags: [{ ref: "tag-1", name: "priority", color: "#123456" }],
      applications: [{ ref: "application-1", company: "Tally", tagRefs: ["tag-1"] }],
    });
    expect(response.body.applications[0].notes).toHaveLength(1);
    expect(response.body.applications[0].interviews).toHaveLength(1);
    expect(response.body.applications[0].statusHistory).toHaveLength(1);
    expect(keysIn(response.body)).not.toEqual(
      expect.arrayContaining([
        "id",
        "userId",
        "email",
        "passwordHash",
        "tokenHash",
        "oauthAccounts",
      ]),
    );
  });
});
