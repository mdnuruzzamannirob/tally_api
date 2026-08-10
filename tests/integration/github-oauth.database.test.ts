import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import type { EmailService } from "../../src/email/email.service.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { AuthRepository } from "../../src/modules/auth/auth.repository.js";
import { AuthService } from "../../src/modules/auth/auth.service.js";
import { GitHubOAuthService } from "../../src/oauth/github-oauth.service.js";
import type { GitHubOAuthClient, GitHubProfile } from "../../src/oauth/github.oauth.js";
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

class TestGitHubClient implements GitHubOAuthClient {
  profile: GitHubProfile = {
    providerAccountId: "github-user-1",
    email: "github@example.test",
    emailVerified: true,
    name: "GitHub User",
  };
  getAuthorizationUrl(state: string, _redirectUri: string): string {
    void _redirectUri;
    return `https://provider.example/authorize?state=${encodeURIComponent(state)}`;
  }
  async exchangeCode(_code: string, _redirectUri: string): Promise<GitHubProfile> {
    void _code;
    void _redirectUri;
    return this.profile;
  }
}

function stateFrom(location: string | undefined): string {
  const state = location ? new URL(location).searchParams.get("state") : undefined;
  if (!state) throw new Error("OAuth state missing.");
  return state;
}

describe.skipIf(!runDatabaseTests)("GitHub OAuth", () => {
  const client = new TestGitHubClient();
  let prisma: PrismaClient;
  let app: Express;

  beforeAll(() => {
    prisma = createTestPrismaClient();
    app = createApp({
      checkDatabase: async () => undefined,
      authService: new AuthService(new AuthRepository(prisma), new TestEmailService()),
      githubOAuthService: new GitHubOAuthService(prisma, client),
    });
  });
  beforeEach(async () => {
    client.profile = {
      providerAccountId: "github-user-1",
      email: "github@example.test",
      emailVerified: true,
      name: "GitHub User",
    };
    await clearTestDatabase(prisma);
    await prisma.oAuthState.deleteMany();
  });
  afterAll(async () => {
    await clearTestDatabase(prisma);
    await prisma.oAuthState.deleteMany();
    await prisma.$disconnect();
  });

  it("uses one-time state and creates a verified GitHub session", async () => {
    const start = await request(app).get("/api/v1/auth/github");
    const state = stateFrom(start.headers.location);
    expect((await prisma.oAuthState.findFirstOrThrow()).stateHash).not.toBe(state);
    const callback = await request(app)
      .get("/api/v1/auth/github/callback")
      .query({ code: "code", state });
    expect(callback.status).toBe(302);
    expect(callback.headers.location).toContain("status=success");
    expect(callback.headers["set-cookie"]?.[0]).toContain("tally_rt=");
    const user = await prisma.user.findUniqueOrThrow({ where: { email: client.profile.email } });
    expect(user.emailVerified).toBe(true);
    await expect(
      prisma.oauthAccount.count({ where: { userId: user.id, provider: "GITHUB" } }),
    ).resolves.toBe(1);
    const replay = await request(app)
      .get("/api/v1/auth/github/callback")
      .query({ code: "code", state });
    expect(replay.headers.location).toContain("status=error");
  });

  it("rejects an unverified GitHub email with a safe redirect", async () => {
    client.profile = { ...client.profile, emailVerified: false, email: "unverified@example.test" };
    const start = await request(app).get("/api/v1/auth/github");
    const callback = await request(app)
      .get("/api/v1/auth/github/callback")
      .query({ code: "code", state: stateFrom(start.headers.location) });
    expect(callback.headers.location).toContain("status=error");
    await expect(prisma.user.count({ where: { email: client.profile.email } })).resolves.toBe(0);
  });

  it("links a verified GitHub profile to the existing matching-email user", async () => {
    const existingUser = await prisma.user.create({
      data: { email: client.profile.email, emailVerified: true, emailVerifiedAt: new Date() },
    });
    const start = await request(app).get("/api/v1/auth/github");
    const callback = await request(app)
      .get("/api/v1/auth/github/callback")
      .query({ code: "code", state: stateFrom(start.headers.location) });
    expect(callback.headers.location).toContain("status=success");
    expect(
      (await prisma.oauthAccount.findFirstOrThrow({ where: { provider: "GITHUB" } })).userId,
    ).toBe(existingUser.id);
  });
});
