import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { createAccessToken } from "../../src/lib/jwt.js";
import type { EmailService } from "../../src/email/email.service.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { AuthService } from "../../src/modules/auth/auth.service.js";
import { GoogleOAuthService } from "../../src/oauth/google-oauth.service.js";
import type { GoogleOAuthClient, GoogleProfile } from "../../src/oauth/google.oauth.js";
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

class TestGoogleClient implements GoogleOAuthClient {
  profile: GoogleProfile = {
    providerAccountId: "google-user-1",
    email: "google@example.test",
    emailVerified: true,
    name: "Google User",
  };

  getAuthorizationUrl(state: string, _redirectUri: string): string {
    void _redirectUri;
    return `https://provider.example/authorize?state=${encodeURIComponent(state)}`;
  }

  async exchangeCode(_code: string, _redirectUri: string): Promise<GoogleProfile> {
    void _code;
    void _redirectUri;
    return this.profile;
  }
}

function getState(location: string | undefined): string {
  const state = location ? new URL(location).searchParams.get("state") : undefined;
  if (!state) throw new Error("OAuth authorization state was not returned.");
  return state;
}

describe.skipIf(!runDatabaseTests)("Google OAuth", () => {
  const client = new TestGoogleClient();
  let prisma: PrismaClient;
  let app: Express;

  beforeAll(() => {
    prisma = createTestPrismaClient();
    const authService = new AuthService(prisma, new TestEmailService());
    app = createApp({
      checkDatabase: async () => undefined,
      authService,
      googleOAuthService: new GoogleOAuthService(prisma, client),
    });
  });

  beforeEach(async () => {
    client.profile = {
      providerAccountId: "google-user-1",
      email: "google@example.test",
      emailVerified: true,
      name: "Google User",
    };
    await clearTestDatabase(prisma);
    await prisma.oAuthState.deleteMany();
  });

  afterAll(async () => {
    await clearTestDatabase(prisma);
    await prisma.oAuthState.deleteMany();
    await prisma.$disconnect();
  });

  it("creates a verified user, stores only hashed state, and consumes it once", async () => {
    const start = await request(app).get("/api/v1/auth/google");
    expect(start.status).toBe(302);
    const state = getState(start.headers.location);
    const storedState = await prisma.oAuthState.findFirstOrThrow();
    expect(storedState.stateHash).not.toBe(state);

    const callback = await request(app)
      .get("/api/v1/auth/google/callback")
      .query({ code: "authorization-code", state });
    expect(callback.status).toBe(302);
    expect(callback.headers.location).toContain("status=success");
    expect(callback.headers["set-cookie"]?.[0]).toContain("tally_rt=");

    const user = await prisma.user.findUniqueOrThrow({ where: { email: client.profile.email } });
    expect(user.emailVerified).toBe(true);
    await expect(
      prisma.oauthAccount.count({ where: { userId: user.id, provider: "GOOGLE" } }),
    ).resolves.toBe(1);
    await expect(prisma.oAuthState.count()).resolves.toBe(0);

    const replay = await request(app)
      .get("/api/v1/auth/google/callback")
      .query({ code: "authorization-code", state });
    expect(replay.status).toBe(302);
    expect(replay.headers.location).toContain("status=error");
  });

  it("links a verified Google profile to an existing matching-email user", async () => {
    const existingUser = await prisma.user.create({
      data: { email: client.profile.email, emailVerified: true, emailVerifiedAt: new Date() },
    });
    const start = await request(app).get("/api/v1/auth/google");
    const callback = await request(app)
      .get("/api/v1/auth/google/callback")
      .query({ code: "authorization-code", state: getState(start.headers.location) });
    expect(callback.headers.location).toContain("status=success");
    const account = await prisma.oauthAccount.findFirstOrThrow({ where: { provider: "GOOGLE" } });
    expect(account.userId).toBe(existingUser.id);
  });

  it("fails safely when Google reports an unverified email", async () => {
    client.profile = { ...client.profile, emailVerified: false, email: "unverified@example.test" };
    const start = await request(app).get("/api/v1/auth/google");
    const callback = await request(app)
      .get("/api/v1/auth/google/callback")
      .query({ code: "authorization-code", state: getState(start.headers.location) });
    expect(callback.status).toBe(302);
    expect(callback.headers.location).toContain("status=error");
    await expect(prisma.user.count({ where: { email: client.profile.email } })).resolves.toBe(0);
  });

  it("binds a link transaction to the authenticated user instead of the provider email", async () => {
    const linkedUser = await prisma.user.create({
      data: { email: "linked@example.test", passwordHash: "hash", emailVerified: true },
    });
    const matchingEmailUser = await prisma.user.create({
      data: { email: client.profile.email, emailVerified: true },
    });
    const accessToken = createAccessToken({ sub: linkedUser.id, emailVerified: true });

    const start = await request(app)
      .post("/api/v1/auth/connected-accounts/google/link")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(start.status).toBe(200);
    const state = getState(start.body.data.authorizationUrl);
    const callback = await request(app)
      .get("/api/v1/auth/google/callback")
      .query({ code: "authorization-code", state });
    expect(callback.headers.location).toContain("status=success");
    expect(callback.headers.location).toContain("intent=link");
    expect(callback.headers["set-cookie"]).toBeUndefined();

    const account = await prisma.oauthAccount.findFirstOrThrow({ where: { provider: "GOOGLE" } });
    expect(account.userId).toBe(linkedUser.id);
    expect(account.userId).not.toBe(matchingEmailUser.id);
  });

  it("does not allow the last login method to be disconnected", async () => {
    const user = await prisma.user.create({ data: { email: "only-google@example.test" } });
    await prisma.oauthAccount.create({
      data: { userId: user.id, provider: "GOOGLE", providerAccountId: "only-google" },
    });
    const accessToken = createAccessToken({ sub: user.id, emailVerified: false });
    const response = await request(app)
      .delete("/api/v1/auth/connected-accounts/google")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");
    await expect(prisma.oauthAccount.count({ where: { userId: user.id } })).resolves.toBe(1);
  });
});
