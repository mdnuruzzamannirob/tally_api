import { getRefreshTokenExpiresAt } from "../config/cookie.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { ApiError } from "../lib/api-error.js";
import { generateOpaqueToken, hashToken } from "../lib/crypto.js";
import type { GoogleOAuthClient, GoogleProfile } from "./google.oauth.js";
import { OAuthRepository } from "./oauth.repository.js";

const STATE_LIFETIME_MS = 10 * 60 * 1_000;

export class GoogleOAuthService {
  constructor(
    repository: OAuthRepository | PrismaClient,
    private readonly client: GoogleOAuthClient,
  ) {
    this.repository =
      repository instanceof OAuthRepository ? repository : new OAuthRepository(repository);
  }

  private readonly repository: OAuthRepository;

  private get prisma() {
    return this.repository.client;
  }

  async start(redirectUri: string, linkUserId?: string): Promise<string> {
    const state = generateOpaqueToken();
    await this.prisma.oAuthState.create({
      data: {
        provider: "GOOGLE",
        intent: linkUserId ? "LINK" : "LOGIN",
        userId: linkUserId ?? null,
        stateHash: hashToken(state),
        expiresAt: new Date(Date.now() + STATE_LIFETIME_MS),
      },
    });
    return this.client.getAuthorizationUrl(state, redirectUri);
  }

  async complete(
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<{ intent: "login"; refreshToken: string } | { intent: "link" }> {
    const oauthState = await this.consumeState(state);
    const profile = await this.client.exchangeCode(code, redirectUri);
    if (!profile.emailVerified)
      throw new ApiError(403, "FORBIDDEN", "Google account email is not verified.");
    if (oauthState.intent === "LINK") {
      if (!oauthState.userId)
        throw new ApiError(400, "BAD_REQUEST", "OAuth link state is invalid.");
      await this.linkToUser(oauthState.userId, profile);
      return { intent: "link" };
    }
    const user = await this.resolveUser(profile);
    const refreshToken = generateOpaqueToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: getRefreshTokenExpiresAt(),
      },
    });
    return { intent: "login", refreshToken };
  }

  private async consumeState(state: string) {
    const record = await this.prisma.oAuthState.findUnique({
      where: { stateHash: hashToken(state) },
    });
    if (!record || record.provider !== "GOOGLE" || record.expiresAt <= new Date()) {
      if (record) await this.prisma.oAuthState.delete({ where: { id: record.id } });
      throw new ApiError(400, "BAD_REQUEST", "OAuth state is invalid or expired.");
    }
    const consumed = await this.prisma.oAuthState.deleteMany({ where: { id: record.id } });
    if (consumed.count !== 1)
      throw new ApiError(400, "BAD_REQUEST", "OAuth state is invalid or expired.");
    return record;
  }

  private async linkToUser(userId: string, profile: GoogleProfile): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({ where: { id: userId } });
      if (!user) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
      const account = await transaction.oauthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: "GOOGLE",
            providerAccountId: profile.providerAccountId,
          },
        },
      });
      if (account?.userId === userId) return;
      if (account) throw new ApiError(409, "CONFLICT", "This Google account is already connected.");
      const providerForUser = await transaction.oauthAccount.findUnique({
        where: { userId_provider: { userId, provider: "GOOGLE" } },
      });
      if (providerForUser)
        throw new ApiError(409, "CONFLICT", "A Google account is already connected.");
      await transaction.oauthAccount.create({
        data: {
          userId,
          provider: "GOOGLE",
          providerAccountId: profile.providerAccountId,
          email: profile.email,
        },
      });
    });
  }

  private async resolveUser(profile: GoogleProfile): Promise<{ id: string }> {
    const account = await this.prisma.oauthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "GOOGLE",
          providerAccountId: profile.providerAccountId,
        },
      },
    });
    if (account) return { id: account.userId };

    return this.prisma.$transaction(async (transaction) => {
      let user = await transaction.user.findUnique({ where: { email: profile.email } });
      if (!user) {
        user = await transaction.user.create({
          data: {
            name: profile.name,
            email: profile.email,
            emailVerified: true,
            emailVerifiedAt: new Date(),
          },
        });
      } else if (!user.emailVerified) {
        user = await transaction.user.update({
          where: { id: user.id },
          data: { emailVerified: true, emailVerifiedAt: new Date() },
        });
      }
      await transaction.oauthAccount.create({
        data: {
          userId: user.id,
          provider: "GOOGLE",
          providerAccountId: profile.providerAccountId,
          email: profile.email,
        },
      });
      return { id: user.id };
    });
  }
}
