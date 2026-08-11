import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createAccessToken } from "../../../src/core/security/jwt.js";
import { hashPassword, verifyPassword } from "../../../src/core/security/password.js";
import { REFRESH_COOKIE_NAME } from "../../../src/core/config/cookie.config.js";
import { hashToken } from "../../../src/core/security/crypto.js";
import type { EmailService } from "../../../src/email/email.service.js";
import { createApp } from "../../../src/app.js";
import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { AuthRepository } from "../../../src/modules/auth/auth.repository.js";
import { AuthService } from "../../../src/modules/auth/auth.service.js";
import { clearTestDatabase, createTestPrismaClient } from "../../helpers/db.js";

const runDatabaseTests = Boolean(process.env.TEST_DATABASE_URL);

class TestEmailService implements EmailService {
  readonly resetEmails: Array<{ email: string; token: string }> = [];

  async sendVerificationEmail(_input: { email: string; token: string }): Promise<void> {
    void _input;
  }

  async sendPasswordResetEmail(input: { email: string; token: string }): Promise<void> {
    this.resetEmails.push(input);
  }
}

describe.skipIf(!runDatabaseTests)("password recovery and management", () => {
  const emailService = new TestEmailService();
  let prisma: PrismaClient;
  let authService: AuthService;
  let app: Express;

  beforeAll(() => {
    prisma = createTestPrismaClient();
    authService = new AuthService(new AuthRepository(prisma), emailService);
    app = createApp({ checkDatabase: async () => undefined, authService });
  });

  beforeEach(async () => {
    emailService.resetEmails.length = 0;
    await clearTestDatabase(prisma);
  });

  afterAll(async () => {
    await clearTestDatabase(prisma);
    await prisma.$disconnect();
  });

  async function createPasswordUser(email: string) {
    return prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword("old-safe-password"),
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
  }

  it("issues a hashed single-use reset token and revokes all sessions after reset", async () => {
    const user = await createPasswordUser("reset@example.test");
    await authService.login(
      { email: user.email, password: "old-safe-password" },
      { userAgent: undefined, ip: undefined },
    );
    await authService.login(
      { email: user.email, password: "old-safe-password" },
      { userAgent: undefined, ip: undefined },
    );

    const forgot = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "RESET@EXAMPLE.TEST" });
    expect(forgot.status).toBe(200);
    const resetEmail = emailService.resetEmails.at(-1);
    if (!resetEmail) throw new Error("Password reset email was not sent.");
    const storedToken = await prisma.passwordResetToken.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(storedToken.tokenHash).toBe(hashToken(resetEmail.token));
    expect(storedToken.tokenHash).not.toBe(resetEmail.token);

    const reset = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: resetEmail.token, password: "new-safe-password" });
    expect(reset.status).toBe(200);
    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    await expect(verifyPassword("new-safe-password", updatedUser.passwordHash!)).resolves.toBe(
      true,
    );
    expect(
      (await prisma.passwordResetToken.findUniqueOrThrow({ where: { id: storedToken.id } })).usedAt,
    ).toBeInstanceOf(Date);
    await expect(
      prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } }),
    ).resolves.toBe(0);

    await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: resetEmail.token, password: "another-password" })
      .expect(400);
  });

  it("keeps only the current refresh session on password change and supports OAuth-only set-password", async () => {
    const user = await createPasswordUser("change@example.test");
    const currentSession = await authService.login(
      { email: user.email, password: "old-safe-password" },
      { userAgent: undefined, ip: undefined },
    );
    await authService.login(
      { email: user.email, password: "old-safe-password" },
      { userAgent: undefined, ip: undefined },
    );

    const changed = await request(app)
      .patch("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${currentSession.accessToken}`)
      .set("Cookie", `${REFRESH_COOKIE_NAME}=${currentSession.refreshToken}`)
      .send({ currentPassword: "old-safe-password", newPassword: "changed-safe-password" });
    expect(changed.status).toBe(200);
    await expect(
      prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } }),
    ).resolves.toBe(1);
    const currentToken = await prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(currentSession.refreshToken) },
    });
    expect(currentToken.revokedAt).toBeNull();

    const oauthUser = await prisma.user.create({
      data: { email: "oauth-only@example.test", emailVerified: true, emailVerifiedAt: new Date() },
    });
    const oauthAccessToken = createAccessToken({ sub: oauthUser.id, emailVerified: true });
    await request(app)
      .post("/api/v1/auth/set-password")
      .set("Authorization", `Bearer ${oauthAccessToken}`)
      .send({ newPassword: "oauth-safe-password" })
      .expect(200);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: oauthUser.id } })).passwordHash,
    ).not.toBeNull();
    await request(app)
      .post("/api/v1/auth/set-password")
      .set("Authorization", `Bearer ${oauthAccessToken}`)
      .send({ newPassword: "different-password" })
      .expect(409);
  });
});
