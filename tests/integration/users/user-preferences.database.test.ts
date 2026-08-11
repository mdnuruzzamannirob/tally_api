import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../../src/app.js";
import { createAccessToken } from "../../../src/core/security/jwt.js";
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

describe.skipIf(!runDatabaseTests)("user profile and preferences", () => {
  let prisma: PrismaClient;
  let app: Express;

  beforeAll(() => {
    prisma = createTestPrismaClient();
    app = createApp({
      checkDatabase: async () => undefined,
      authService: new AuthService(new AuthRepository(prisma), new TestEmailService()),
    });
  });

  beforeEach(async () => {
    await clearTestDatabase(prisma);
  });

  afterAll(async () => {
    await clearTestDatabase(prisma);
    await prisma.$disconnect();
  });

  it("updates profile and rejects attempts to change email", async () => {
    const user = await prisma.user.create({ data: { email: "profile@example.test" } });
    const accessToken = createAccessToken({ sub: user.id, emailVerified: false });

    const updated = await request(app)
      .patch("/api/v1/users/me/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "  Tally User  " });
    expect(updated.status).toBe(200);
    expect(updated.body.data.user).toMatchObject({ name: "Tally User", email: user.email });

    const rejected = await request(app)
      .patch("/api/v1/users/me/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ email: "changed@example.test" });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.code).toBe("VALIDATION_ERROR");
    await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({
      email: user.email,
    });
  });

  it("persists valid preferences and rejects invalid IANA time zones", async () => {
    const user = await prisma.user.create({ data: { email: "preferences@example.test" } });
    const accessToken = createAccessToken({ sub: user.id, emailVerified: false });
    const updated = await request(app)
      .patch("/api/v1/users/me/preferences")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        theme: "dark",
        defaultLandingPage: "applications",
        timeZone: "Asia/Dhaka",
        notificationsEnabled: true,
      });
    expect(updated.status).toBe(200);
    expect(updated.body.data.user.preferences).toMatchObject({
      theme: "dark",
      defaultLandingPage: "applications",
      timeZone: "Asia/Dhaka",
      notificationsEnabled: true,
    });

    const invalid = await request(app)
      .patch("/api/v1/users/me/preferences")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ timeZone: "Invalid/TimeZone" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
  });
});
