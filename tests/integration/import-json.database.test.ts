import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { createAccessToken } from "../../src/auth/jwt.js";
import type { EmailService } from "../../src/email/email.service.js";
import { ImportService } from "../../src/modules/export-import/import.service.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { AuthService } from "../../src/modules/auth/auth.service.js";
import { clearTestDatabase, createTestPrismaClient } from "../helpers/database.js";

const runDatabaseTests = Boolean(process.env.TEST_DATABASE_URL);
const createdAt = "2026-01-01T00:00:00.000Z";
const updatedAt = "2026-01-02T00:00:00.000Z";

class TestEmailService implements EmailService {
  async sendVerificationEmail(_input: { email: string; token: string }): Promise<void> {
    void _input;
  }

  async sendPasswordResetEmail(_input: { email: string; token: string }): Promise<void> {
    void _input;
  }
}

function validBackup() {
  return {
    version: 1,
    exportedAt: updatedAt,
    profile: {
      name: "Imported User",
      email: "ignored@example.test",
      preferences: {
        theme: "DARK",
        defaultLandingPage: "APPLICATIONS",
        timeZone: "Asia/Dhaka",
        notificationsEnabled: true,
      },
    },
    tags: [{ ref: "tag-1", name: "Priority", color: "#123456" }],
    applications: [
      {
        ref: "application-1",
        company: "Imported Tally",
        role: "Engineer",
        jobUrl: null,
        location: null,
        remoteType: null,
        employmentType: null,
        source: null,
        status: "APPLIED",
        appliedAt: "2026-01-01",
        salaryMin: "100",
        salaryMax: "200",
        currency: "USD",
        nextFollowUpAt: null,
        archivedAt: null,
        createdAt,
        updatedAt,
        tagRefs: ["tag-1"],
        notes: [{ content: "Imported note", createdAt, updatedAt }],
        interviews: [
          {
            type: "TECHNICAL",
            scheduledAt: updatedAt,
            interviewerName: null,
            meetingLink: null,
            location: null,
            notes: null,
            status: "SCHEDULED",
            createdAt,
            updatedAt,
          },
        ],
        statusHistory: [
          { fromStatus: "WISHLIST", toStatus: "APPLIED", note: null, changedAt: updatedAt },
        ],
      },
    ],
  };
}

describe.skipIf(!runDatabaseTests)("JSON import", () => {
  let prisma: PrismaClient;
  let app: Express;

  beforeAll(() => {
    prisma = createTestPrismaClient();
    app = createApp({
      checkDatabase: async () => undefined,
      authService: new AuthService(prisma, new TestEmailService()),
      importService: new ImportService(prisma),
    });
  });

  beforeEach(async () => {
    await clearTestDatabase(prisma);
  });

  afterAll(async () => {
    await clearTestDatabase(prisma);
    await prisma.$disconnect();
  });

  it("replaces only portable data and restores local references with new database IDs", async () => {
    const user = await prisma.user.create({
      data: { email: "import@example.test", name: "Original" },
    });
    const oldApplication = await prisma.application.create({
      data: { userId: user.id, company: "Old", role: "Role" },
    });
    const accessToken = createAccessToken({ sub: user.id, emailVerified: false });
    const response = await request(app)
      .post("/api/v1/import/json")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validBackup());
    expect(response.status).toBe(200);
    await expect(
      prisma.application.findUnique({ where: { id: oldApplication.id } }),
    ).resolves.toBeNull();
    const imported = await prisma.application.findFirstOrThrow({
      where: { userId: user.id },
      include: { tags: true, notes: true, interviews: true, statusHistory: true },
    });
    expect(imported).toMatchObject({ company: "Imported Tally", status: "APPLIED" });
    expect(imported.tags).toHaveLength(1);
    expect(imported.notes).toHaveLength(1);
    expect(imported.interviews).toHaveLength(1);
    expect(imported.statusHistory).toHaveLength(1);
    await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({
      email: "import@example.test",
      name: "Imported User",
      theme: "DARK",
      timeZone: "Asia/Dhaka",
    });
  });

  it("rejects invalid references before changing existing data", async () => {
    const user = await prisma.user.create({ data: { email: "invalid-import@example.test" } });
    const existing = await prisma.application.create({
      data: { userId: user.id, company: "Keep", role: "Role" },
    });
    const backup = validBackup();
    const firstApplication = backup.applications[0];
    if (!firstApplication) throw new Error("Expected an application in the backup fixture.");
    firstApplication.tagRefs = ["missing-ref"];
    const accessToken = createAccessToken({ sub: user.id, emailVerified: false });
    const response = await request(app)
      .post("/api/v1/import/json")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(backup);
    expect(response.status).toBe(400);
    await expect(
      prisma.application.findUnique({ where: { id: existing.id } }),
    ).resolves.not.toBeNull();
  });
});
