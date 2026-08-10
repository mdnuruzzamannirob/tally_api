import type { PrismaClient } from "../../generated/prisma/client.js";
import { createAccessToken } from "../../auth/jwt.js";
import type { EmailService } from "../../email/email.service.js";
import { ApiError } from "../../utils/api-error.js";
import { hashPassword, verifyPassword } from "../../auth/password.js";
import { getRefreshTokenExpiresAt } from "../../auth/refresh-cookie.js";
import { generateOpaqueToken, hashToken } from "../../auth/tokens.js";
import type { LoginInput, RegisterInput } from "./auth.validators.js";

const VERIFICATION_TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1_000;

type PublicUser = {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  hasPassword: boolean;
  providers: string[];
  preferences: {
    theme: string;
    defaultLandingPage: string;
    timeZone: string;
    notificationsEnabled: boolean;
  };
};

type SessionMetadata = { userAgent: string | undefined; ip: string | undefined };

function toPublicUser(user: {
  id: string;
  name: string | null;
  email: string;
  passwordHash: string | null;
  emailVerified: boolean;
  theme: string;
  defaultLandingPage: string;
  timeZone: string;
  notificationsEnabled: boolean;
  oauthAccounts: Array<{ provider: string }>;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    hasPassword: Boolean(user.passwordHash),
    providers: user.oauthAccounts.map(({ provider }) => provider.toLowerCase()),
    preferences: {
      theme: user.theme.toLowerCase(),
      defaultLandingPage: user.defaultLandingPage.toLowerCase(),
      timeZone: user.timeZone,
      notificationsEnabled: user.notificationsEnabled,
    },
  };
}

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly emailService: EmailService,
  ) {}

  async register(input: RegisterInput): Promise<void> {
    const existingUser = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existingUser)
      throw new ApiError(409, "CONFLICT", "An account with this email already exists.");

    const passwordHash = await hashPassword(input.password);
    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_LIFETIME_MS);

    await this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: { name: input.name ?? null, email: input.email, passwordHash },
      });
      await transaction.emailVerificationToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });
    });

    await this.emailService.sendVerificationEmail({ email: input.email, token: rawToken });
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const token = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!token || token.expiresAt <= new Date()) {
      throw new ApiError(
        400,
        "INVALID_OR_EXPIRED_TOKEN",
        "Verification token is invalid or expired.",
      );
    }

    const verifiedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: token.userId },
        data: { emailVerified: true, emailVerifiedAt: verifiedAt },
      }),
      this.prisma.emailVerificationToken.deleteMany({ where: { userId: token.userId } }),
    ]);
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerified) return;

    const rawToken = generateOpaqueToken();
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } }),
      this.prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_LIFETIME_MS),
        },
      }),
    ]);

    await this.emailService.sendVerificationEmail({ email: user.email, token: rawToken });
  }

  async login(
    input: LoginInput,
    metadata: SessionMetadata,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: PublicUser;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { oauthAccounts: true },
    });
    if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }
    if (!user.emailVerified) {
      throw new ApiError(403, "EMAIL_NOT_VERIFIED", "Email verification is required.");
    }

    const refreshToken = generateOpaqueToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: getRefreshTokenExpiresAt(),
        userAgent: metadata.userAgent ?? null,
        ip: metadata.ip ?? null,
      },
    });

    return {
      accessToken: createAccessToken({ sub: user.id, emailVerified: user.emailVerified }),
      refreshToken,
      user: toPublicUser(user),
    };
  }

  async getCurrentUser(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { oauthAccounts: true },
    });
    if (!user) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
    return toPublicUser(user);
  }

  async refresh(
    refreshToken: string,
    metadata: SessionMetadata,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });
    if (!existing || existing.expiresAt <= new Date()) {
      throw new ApiError(401, "UNAUTHORIZED", "Refresh token is invalid or expired.");
    }
    if (existing.revokedAt) {
      await this.revokeUserSessions(existing.userId);
      throw new ApiError(401, "UNAUTHORIZED", "Refresh token is invalid or expired.");
    }

    const nextRefreshToken = generateOpaqueToken();
    const nextRefreshTokenHash = hashToken(nextRefreshToken);
    const revokedAt = new Date();
    const rotated = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.refreshToken.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: { revokedAt, replacedByHash: nextRefreshTokenHash },
      });
      if (result.count !== 1) return false;

      await transaction.refreshToken.create({
        data: {
          userId: existing.userId,
          tokenHash: nextRefreshTokenHash,
          expiresAt: getRefreshTokenExpiresAt(),
          userAgent: metadata.userAgent ?? null,
          ip: metadata.ip ?? null,
        },
      });
      return true;
    });
    if (!rotated) {
      await this.revokeUserSessions(existing.userId);
      throw new ApiError(401, "UNAUTHORIZED", "Refresh token is invalid or expired.");
    }

    return {
      accessToken: createAccessToken({
        sub: existing.userId,
        emailVerified: existing.user.emailVerified,
      }),
      refreshToken: nextRefreshToken,
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeUserSessions(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
