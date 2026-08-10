import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { createAccessToken } from "../../src/lib/jwt.js";
import type { EmailService } from "../../src/email/email.service.js";
import { ExportService } from "../../src/modules/export-import/export.service.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { AuthRepository } from "../../src/modules/auth/auth.repository.js";
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

describe.skipIf(!runDatabaseTests)("CSV export", () => {
  let prisma: PrismaClient;
  let app: Express;

  beforeAll(() => {
    prisma = createTestPrismaClient();
    app = createApp({
      checkDatabase: async () => undefined,
      authService: new AuthService(new AuthRepository(prisma), new TestEmailService()),
      exportService: new ExportService(prisma),
    });
  });

  beforeEach(async () => {
    await clearTestDatabase(prisma);
  });

  afterAll(async () => {
    await clearTestDatabase(prisma);
    await prisma.$disconnect();
  });

  it("exports RFC 4180 rows with JSON tags and neutralized formula-like values", async () => {
    const user = await prisma.user.create({ data: { email: "csv@example.test" } });
    const tag = await prisma.tag.create({ data: { userId: user.id, name: "urgent, high" } });
    const application = await prisma.application.create({
      data: {
        userId: user.id,
        company: "=formula-like",
        role: 'Developer, "Platform"',
        status: "APPLIED",
        source: "+referral",
        salaryMin: 100,
        currency: "USD",
      },
    });
    await prisma.applicationTag.create({ data: { applicationId: application.id, tagId: tag.id } });
    const accessToken = createAccessToken({ sub: user.id, emailVerified: false });

    const response = await request(app)
      .get("/api/v1/export/csv")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toMatch(
      /^attachment; filename="tally-applications-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    expect(response.text.split("\r\n")[0]).toBe(
      "company,role,status,jobUrl,location,remoteType,employmentType,source,appliedAt,nextFollowUpAt,salaryMin,salaryMax,currency,tags,createdAt,updatedAt",
    );
    expect(response.text).toContain('"\'=formula-like"');
    expect(response.text).toContain('"\'+referral"');
    expect(response.text).toContain('"Developer, ""Platform"""');
    expect(response.text).toContain('[\\"urgent, high\\"]');
  });
});
