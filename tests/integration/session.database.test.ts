import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { hashPassword } from "../../src/auth/password.js";
import { REFRESH_COOKIE_NAME } from "../../src/auth/refresh-cookie.js";
import type { EmailService } from "../../src/email/email.service.js";
import { createApp } from "../../src/app.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { AuthService } from "../../src/modules/auth/auth.service.js";
import { clearTestDatabase, createTestPrismaClient } from "../helpers/database.js";

const runDatabaseTests = Boolean(process.env.TEST_DATABASE_URL);
const originHeaders = { Origin: "http://localhost:3000", "X-Requested-With": "XMLHttpRequest" };

class TestEmailService implements EmailService {
  async sendVerificationEmail(_input: { email: string; token: string }): Promise<void> {
    void _input;
  }

  async sendPasswordResetEmail(_input: { email: string; token: string }): Promise<void> {
    void _input;
  }
}

function getRefreshToken(setCookie: string | string[] | undefined): string {
  const cookie = typeof setCookie === "string" ? setCookie : setCookie?.[0];
  const token = cookie?.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))?.[1];
  if (!token) throw new Error("Refresh cookie was not set.");
  return token;
}

describe.skipIf(!runDatabaseTests)("login, refresh, and logout", () => {
  let prisma: PrismaClient;
  let app: Express;

  beforeAll(() => {
    prisma = createTestPrismaClient();
    app = createApp({
      checkDatabase: async () => undefined,
      authService: new AuthService(prisma, new TestEmailService()),
    });
  });

  beforeEach(async () => {
    await clearTestDatabase(prisma);
  });

  afterAll(async () => {
    await clearTestDatabase(prisma);
    await prisma.$disconnect();
  });

  async function createVerifiedUser(email: string) {
    return prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword("safe-test-password"),
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
  }

  async function login(email: string) {
    return request(app)
      .post("/api/v1/auth/login")
      .set("User-Agent", "Tally integration test")
      .send({ email, password: "safe-test-password" });
  }

  it("issues an access token and an HTTP-only hashed refresh session", async () => {
    const user = await createVerifiedUser("login@example.test");
    const response = await login(user.email);

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.user).toMatchObject({
      id: user.id,
      email: user.email,
      emailVerified: true,
      hasPassword: true,
      providers: [],
    });

    const refreshToken = getRefreshToken(response.headers["set-cookie"]);
    const storedToken = await prisma.refreshToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(storedToken.tokenHash).not.toBe(refreshToken);
    expect(storedToken.userAgent).toBe("Tally integration test");

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${response.body.data.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.id).toBe(user.id);
  });

  it("rotates refresh tokens and revokes every session after replay", async () => {
    const user = await createVerifiedUser("rotate@example.test");
    const loginResponse = await login(user.email);
    const firstToken = getRefreshToken(loginResponse.headers["set-cookie"]);

    const refresh = await request(app)
      .post("/api/v1/auth/refresh")
      .set(originHeaders)
      .set("Cookie", `${REFRESH_COOKIE_NAME}=${firstToken}`);
    expect(refresh.status).toBe(200);
    const secondToken = getRefreshToken(refresh.headers["set-cookie"]);
    expect(secondToken).not.toBe(firstToken);
    await expect(
      prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } }),
    ).resolves.toBe(1);

    const replay = await request(app)
      .post("/api/v1/auth/refresh")
      .set(originHeaders)
      .set("Cookie", `${REFRESH_COOKIE_NAME}=${firstToken}`);
    expect(replay.status).toBe(401);
    await expect(
      prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } }),
    ).resolves.toBe(0);
  });

  it("revokes the current refresh token and clears its cookie on logout", async () => {
    const user = await createVerifiedUser("logout@example.test");
    const loginResponse = await login(user.email);
    const refreshToken = getRefreshToken(loginResponse.headers["set-cookie"]);

    const logout = await request(app)
      .post("/api/v1/auth/logout")
      .set(originHeaders)
      .set("Cookie", `${REFRESH_COOKIE_NAME}=${refreshToken}`);
    expect(logout.status).toBe(200);
    expect(logout.body).toEqual({ success: true, data: { message: "Logged out" } });
    expect(logout.headers["set-cookie"]?.[0]).toContain(`${REFRESH_COOKIE_NAME}=;`);
    await expect(
      prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } }),
    ).resolves.toBe(0);
  });
});
