import { createAccessToken } from "../../lib/jwt.js";
import type { EmailService } from "../../email/email.service.js";
import { ApiError } from "../../lib/api-error.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { getRefreshTokenExpiresAt } from "../../config/cookie.js";
import { generateOpaqueToken, hashToken } from "../../lib/crypto.js";
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  UpdatePreferencesInput,
  UpdateProfileInput,
} from "./auth.validators.js";
import { AuthRepository } from "./auth.repository.js";
import type { PrismaClient } from "../../generated/prisma/client.js";

const VERIFICATION_TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1_000;
const PASSWORD_RESET_TOKEN_LIFETIME_MS = 30 * 60 * 1_000;

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
    repository: AuthRepository | PrismaClient,
    private readonly emailService: EmailService,
  ) {
    this.repository = repository instanceof AuthRepository ? repository : new AuthRepository(repository);
  }

  private readonly repository: AuthRepository;

  private get prisma() {
    return this.repository.client;
  }

  async register(input: RegisterInput): Promise<void> {
    const existingUser = await this.repository.findUserByEmail(input.email);
    if (existingUser)
      throw new ApiError(409, "CONFLICT", "An account with this email already exists.");

    const passwordHash = await hashPassword(input.password);
    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_LIFETIME_MS);

    await this.repository.createUserWithVerification({
      name: input.name ?? null,
      email: input.email,
      passwordHash,
      tokenHash,
      expiresAt,
    });

    await this.emailService.sendVerificationEmail({ email: input.email, token: rawToken });
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const token = await this.repository.findVerificationToken(hashToken(rawToken));
    if (!token || token.expiresAt <= new Date()) {
      throw new ApiError(
        400,
        "INVALID_OR_EXPIRED_TOKEN",
        "Verification token is invalid or expired.",
      );
    }

    const verifiedAt = new Date();
    await this.repository.verifyUserAndClearVerificationTokens(token.userId, verifiedAt);
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.repository.findUserByEmail(email);
    if (!user || user.emailVerified) return;

    const rawToken = generateOpaqueToken();
    await this.repository.replaceVerificationToken(
      user.id,
      hashToken(rawToken),
      new Date(Date.now() + VERIFICATION_TOKEN_LIFETIME_MS),
    );

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

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<PublicUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name: input.name ?? null },
      include: { oauthAccounts: true },
    });
    return toPublicUser(user);
  }

  async updatePreferences(userId: string, input: UpdatePreferencesInput): Promise<PublicUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.theme ? { theme: input.theme.toUpperCase() as "LIGHT" | "DARK" | "SYSTEM" } : {}),
        ...(input.defaultLandingPage
          ? {
              defaultLandingPage: input.defaultLandingPage.toUpperCase() as
                "DASHBOARD" | "APPLICATIONS",
            }
          : {}),
        ...(input.timeZone ? { timeZone: input.timeZone } : {}),
        ...(input.notificationsEnabled !== undefined
          ? { notificationsEnabled: input.notificationsEnabled }
          : {}),
      },
      include: { oauthAccounts: true },
    });
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

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const rawToken = generateOpaqueToken();
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_LIFETIME_MS),
        },
      }),
    ]);
    await this.emailService.sendPasswordResetEmail({ email: user.email, token: rawToken });
  }

  async resetPassword(rawToken: string, password: string): Promise<void> {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
      throw new ApiError(
        400,
        "INVALID_OR_EXPIRED_TOKEN",
        "Password reset token is invalid or expired.",
      );
    }

    const passwordHash = await hashPassword(password);
    await this.prisma.$transaction(async (transaction) => {
      const markedUsed = await transaction.passwordResetToken.updateMany({
        where: { id: resetToken.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (markedUsed.count !== 1) {
        throw new ApiError(
          400,
          "INVALID_OR_EXPIRED_TOKEN",
          "Password reset token is invalid or expired.",
        );
      }
      await transaction.user.update({ where: { id: resetToken.userId }, data: { passwordHash } });
      await transaction.refreshToken.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    currentRefreshToken: string | undefined,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
    if (!user.passwordHash) {
      throw new ApiError(409, "CONFLICT", "Use the set-password flow for this account.");
    }
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Current password is incorrect.");
    }

    const passwordHash = await hashPassword(input.newPassword);
    const currentTokenHash = currentRefreshToken ? hashToken(currentRefreshToken) : undefined;
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}),
        },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async setPassword(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
    if (user.passwordHash) {
      throw new ApiError(409, "CONFLICT", "Use the change-password flow for this account.");
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(password) },
    });
  }

  async getConnectedAccounts(userId: string): Promise<{
    providers: Array<{ provider: "google" | "github"; connected: boolean; email: string | null }>;
    hasPassword: boolean;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { oauthAccounts: true },
    });
    if (!user) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
    return {
      providers: (["GOOGLE", "GITHUB"] as const).map((provider) => {
        const account = user.oauthAccounts.find((item) => item.provider === provider);
        return {
          provider: provider.toLowerCase() as "google" | "github",
          connected: Boolean(account),
          email: account?.email ?? null,
        };
      }),
      hasPassword: Boolean(user.passwordHash),
    };
  }

  async unlinkProvider(userId: string, provider: "GOOGLE" | "GITHUB"): Promise<void> {
    await this.prisma.$transaction(
      async (transaction) => {
        const user = await transaction.user.findUnique({
          where: { id: userId },
          include: { oauthAccounts: true },
        });
        if (!user) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
        const account = user.oauthAccounts.find((item) => item.provider === provider);
        if (!account) throw new ApiError(404, "NOT_FOUND", "Connected provider was not found.");
        if (user.oauthAccounts.length + Number(Boolean(user.passwordHash)) <= 1) {
          throw new ApiError(409, "CONFLICT", "Cannot remove the last available login method");
        }
        await transaction.oauthAccount.delete({ where: { id: account.id } });
      },
      { isolationLevel: "Serializable" },
    );
  }

  private async revokeUserSessions(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
