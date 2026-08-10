import type { PrismaClient } from "../generated/prisma/client.js";
import { getRefreshTokenExpiresAt } from "../auth/refresh-cookie.js";
import { generateOpaqueToken, hashToken } from "../auth/tokens.js";
import { ApiError } from "../utils/api-error.js";
import type { GoogleOAuthClient, GoogleProfile } from "./google.oauth.js";

const STATE_LIFETIME_MS = 10 * 60 * 1_000;

export class GoogleOAuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly client: GoogleOAuthClient,
  ) {}

  async start(redirectUri: string): Promise<string> {
    const state = generateOpaqueToken();
    await this.prisma.oAuthState.create({
      data: {
        provider: "GOOGLE",
        stateHash: hashToken(state),
        expiresAt: new Date(Date.now() + STATE_LIFETIME_MS),
      },
    });
    return this.client.getAuthorizationUrl(state, redirectUri);
  }

  async complete(code: string, state: string, redirectUri: string): Promise<string> {
    await this.consumeState(state);
    const profile = await this.client.exchangeCode(code, redirectUri);
    if (!profile.emailVerified)
      throw new ApiError(403, "FORBIDDEN", "Google account email is not verified.");
    const user = await this.resolveUser(profile);
    const refreshToken = generateOpaqueToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: getRefreshTokenExpiresAt(),
      },
    });
    return refreshToken;
  }

  private async consumeState(state: string): Promise<void> {
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
