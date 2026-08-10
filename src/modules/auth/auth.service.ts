import { getRefreshTokenExpiresAt } from "../../config/cookie.js";
import type { EmailService } from "../../email/email.service.js";
import { ApiError } from "../../lib/api-error.js";
import { generateOpaqueToken, hashToken } from "../../lib/crypto.js";
import { createAccessToken } from "../../lib/jwt.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import type { AuthRepository } from "./auth.repository.js";
import type { ChangePasswordInput, LoginInput, RegisterInput } from "./auth.validators.js";

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
    private readonly repository: AuthRepository,
    private readonly emailService: EmailService,
  ) {}

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
    const user = await this.repository.findUserByEmail(input.email);
    if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }
    if (!user.emailVerified) {
      throw new ApiError(403, "EMAIL_NOT_VERIFIED", "Email verification is required.");
    }

    const refreshToken = generateOpaqueToken();
    await this.repository.createRefreshSession({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: getRefreshTokenExpiresAt(),
      ...metadata,
    });

    return {
      accessToken: createAccessToken({ sub: user.id, emailVerified: user.emailVerified }),
      refreshToken,
      user: toPublicUser(user),
    };
  }

  async getCurrentUser(userId: string): Promise<PublicUser> {
    const user = await this.repository.findUserWithConnectedAccounts(userId);
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
    const existing = await this.repository.findRefreshSession(hashToken(refreshToken));
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
    const rotated = await this.repository.rotateRefreshSession({
      id: existing.id,
      userId: existing.userId,
      nextTokenHash: nextRefreshTokenHash,
      expiresAt: getRefreshTokenExpiresAt(),
      revokedAt,
      ...metadata,
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
    await this.repository.revokeRefreshSession(hashToken(refreshToken), new Date());
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.repository.findUserByEmail(email);
    if (!user) return;

    const rawToken = generateOpaqueToken();
    await this.repository.replacePasswordResetToken(
      user.id,
      hashToken(rawToken),
      new Date(Date.now() + PASSWORD_RESET_TOKEN_LIFETIME_MS),
    );
    await this.emailService.sendPasswordResetEmail({ email: user.email, token: rawToken });
  }

  async resetPassword(rawToken: string, password: string): Promise<void> {
    const resetToken = await this.repository.findPasswordResetToken(hashToken(rawToken));
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
      throw new ApiError(
        400,
        "INVALID_OR_EXPIRED_TOKEN",
        "Password reset token is invalid or expired.",
      );
    }

    const passwordHash = await hashPassword(password);
    const consumed = await this.repository.consumePasswordResetAndUpdatePassword(
      resetToken.id,
      resetToken.userId,
      passwordHash,
      new Date(),
    );
    if (!consumed)
      throw new ApiError(
        400,
        "INVALID_OR_EXPIRED_TOKEN",
        "Password reset token is invalid or expired.",
      );
  }

  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    currentRefreshToken: string | undefined,
  ): Promise<void> {
    const user = await this.repository.findUserById(userId);
    if (!user) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
    if (!user.passwordHash) {
      throw new ApiError(409, "CONFLICT", "Use the set-password flow for this account.");
    }
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Current password is incorrect.");
    }

    const passwordHash = await hashPassword(input.newPassword);
    const currentTokenHash = currentRefreshToken ? hashToken(currentRefreshToken) : undefined;
    await this.repository.updatePasswordAndRevokeOtherSessions(
      userId,
      passwordHash,
      currentTokenHash,
      new Date(),
    );
  }

  async setPassword(userId: string, password: string): Promise<void> {
    const user = await this.repository.findUserById(userId);
    if (!user) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
    if (user.passwordHash) {
      throw new ApiError(409, "CONFLICT", "Use the change-password flow for this account.");
    }
    await this.repository.setPassword(userId, await hashPassword(password));
  }

  async getConnectedAccounts(userId: string): Promise<{
    providers: Array<{ provider: "google" | "github"; connected: boolean; email: string | null }>;
    hasPassword: boolean;
  }> {
    const user = await this.repository.findUserWithConnectedAccounts(userId);
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
    const result = await this.repository.unlinkConnectedAccount(userId, provider);
    if (result.kind === "missing-user")
      throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
    if (result.kind === "missing-account")
      throw new ApiError(404, "NOT_FOUND", "Connected provider was not found.");
    if (result.kind === "last-login-method")
      throw new ApiError(409, "CONFLICT", "Cannot remove the last available login method");
  }

  private async revokeUserSessions(userId: string): Promise<void> {
    await this.repository.revokeUserSessions(userId, new Date());
  }
}
