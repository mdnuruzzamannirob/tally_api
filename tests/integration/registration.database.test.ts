import type { EmailService } from "../../src/email/email.service.js";
import type { Express } from "express";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { createApp } from "../../src/app.js";
import { AuthService } from "../../src/modules/auth/auth.service.js";
import { hashToken } from "../../src/auth/tokens.js";
import { clearTestDatabase, createTestPrismaClient } from "../helpers/database.js";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const runDatabaseTests = Boolean(process.env.TEST_DATABASE_URL);

class TestEmailService implements EmailService {
  readonly sent: Array<{ email: string; token: string }> = [];

  async sendVerificationEmail(input: { email: string; token: string }): Promise<void> {
    this.sent.push(input);
  }

  async sendPasswordResetEmail(_input: { email: string; token: string }): Promise<void> {
    void _input;
  }
}

describe.skipIf(!runDatabaseTests)("registration and email verification", () => {
  const emailService = new TestEmailService();
  let prisma: PrismaClient;
  let app: Express;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    const authService = new AuthService(prisma, emailService);
    app = createApp({ checkDatabase: async () => undefined, authService });
    await clearTestDatabase(prisma);
  });

  beforeEach(async () => {
    emailService.sent.length = 0;
    await clearTestDatabase(prisma);
  });

  afterAll(async () => {
    await clearTestDatabase(prisma);
    await prisma.$disconnect();
  });

  it("stores only hashes and verifies the user atomically", async () => {
    const registration = await request(app).post("/api/v1/auth/register").send({
      name: "Test User",
      email: "  PERSON@EXAMPLE.TEST ",
      password: "safe-test-password",
    });
    expect(registration.status).toBe(201);
    expect(registration.body).toEqual({
      success: true,
      data: { message: "Registration successful. Please verify your email." },
    });

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "person@example.test" } });
    expect(user.emailVerified).toBe(false);
    expect(user.passwordHash).not.toBe("safe-test-password");

    const sentEmail = emailService.sent.at(-1);
    if (!sentEmail) throw new Error("Verification email was not sent.");
    const verificationToken = await prisma.emailVerificationToken.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(verificationToken.tokenHash).toBe(hashToken(sentEmail.token));
    expect(verificationToken.tokenHash).not.toBe(sentEmail.token);

    const verification = await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ token: sentEmail.token });
    expect(verification.status).toBe(200);
    expect(verification.body).toEqual({
      success: true,
      data: { message: "Email verified successfully" },
    });

    const verifiedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(verifiedUser.emailVerified).toBe(true);
    expect(verifiedUser.emailVerifiedAt).toBeInstanceOf(Date);
    await expect(prisma.emailVerificationToken.count({ where: { userId: user.id } })).resolves.toBe(
      0,
    );
  });

  it("replaces previous verification tokens and keeps resend responses generic", async () => {
    await request(app).post("/api/v1/auth/register").send({
      email: "resend@example.test",
      password: "safe-test-password",
    });
    const firstEmail = emailService.sent.at(-1);
    if (!firstEmail) throw new Error("Initial verification email was not sent.");

    const resend = await request(app)
      .post("/api/v1/auth/resend-verification")
      .send({ email: "RESEND@EXAMPLE.TEST" });
    expect(resend.status).toBe(200);
    expect(resend.body.data.message).toMatch(/If the account exists/i);

    const resentEmail = emailService.sent.at(-1);
    if (!resentEmail) throw new Error("Resent verification email was not sent.");
    expect(resentEmail.token).not.toBe(firstEmail.token);
    await expect(
      request(app).post("/api/v1/auth/verify-email").send({ token: firstEmail.token }),
    ).resolves.toMatchObject({ status: 400 });

    const unknownAccount = await request(app)
      .post("/api/v1/auth/resend-verification")
      .send({ email: "unknown@example.test" });
    expect(unknownAccount.status).toBe(200);
    expect(unknownAccount.body).toEqual(resend.body);
  });
});
