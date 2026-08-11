import { ApiError } from "../../core/errors/api-error.js";
import { createAccessToken } from "../../core/security/jwt.js";
import { verifyPassword } from "../../core/security/password.js";
import type { EmailService } from "../../email/email.types.js";
import type { AuthRepository } from "./auth.repository.js";
import type { PublicUser, SessionMetadata } from "./auth.types.js";
import { toPublicUser } from "./auth.types.js";
import type { LoginInput, RegisterInput } from "./auth.validators.js";
import { ConnectedAccountsService } from "./connected-accounts/connected-accounts.service.js";
import { PasswordResetService } from "./password/password-reset.service.js";
import { PasswordService } from "./password/password.service.js";
import type { ChangePasswordInput } from "./password/password.validators.js";
import { RefreshTokenService } from "./session/refresh-token.service.js";
import { EmailVerificationService } from "./verification/email-verification.service.js";

export class AuthService {
  private readonly connectedAccounts: ConnectedAccountsService;
  private readonly passwords: PasswordResetService;
  private readonly passwordManagement: PasswordService;
  private readonly sessions: RefreshTokenService;
  private readonly verification: EmailVerificationService;

  constructor(
    private readonly repository: AuthRepository,
    emailService: EmailService,
  ) {
    this.connectedAccounts = new ConnectedAccountsService(repository.connectedAccounts);
    this.passwords = new PasswordResetService(repository, repository.passwords, emailService);
    this.passwordManagement = new PasswordService(repository, repository.passwords);
    this.sessions = new RefreshTokenService(repository.sessions);
    this.verification = new EmailVerificationService(
      repository,
      repository.verification,
      emailService,
    );
  }

  register(input: RegisterInput): Promise<void> {
    return this.verification.register(input);
  }

  verifyEmail(rawToken: string): Promise<void> {
    return this.verification.verify(rawToken);
  }

  resendVerificationEmail(email: string): Promise<void> {
    return this.verification.resend(email);
  }

  async login(
    input: LoginInput,
    metadata: SessionMetadata,
  ): Promise<{ accessToken: string; refreshToken: string; user: PublicUser }> {
    const user = await this.repository.findUserByEmail(input.email);
    if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }
    if (!user.emailVerified) {
      throw new ApiError(403, "EMAIL_NOT_VERIFIED", "Email verification is required.");
    }
    return {
      accessToken: createAccessToken({ sub: user.id, emailVerified: user.emailVerified }),
      refreshToken: await this.sessions.create(user.id, metadata),
      user: toPublicUser(user),
    };
  }

  async getCurrentUser(userId: string): Promise<PublicUser> {
    const user = await this.repository.findUserById(userId);
    if (!user) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
    return toPublicUser(user);
  }

  refresh(refreshToken: string, metadata: SessionMetadata) {
    return this.sessions.refresh(refreshToken, metadata);
  }

  logout(refreshToken: string | undefined): Promise<void> {
    return this.sessions.logout(refreshToken);
  }

  requestPasswordReset(email: string): Promise<void> {
    return this.passwords.request(email);
  }

  resetPassword(rawToken: string, password: string): Promise<void> {
    return this.passwords.reset(rawToken, password);
  }

  changePassword(
    userId: string,
    input: ChangePasswordInput,
    currentRefreshToken: string | undefined,
  ): Promise<void> {
    return this.passwordManagement.change(userId, input, currentRefreshToken);
  }

  setPassword(userId: string, password: string): Promise<void> {
    return this.passwordManagement.set(userId, password);
  }

  getConnectedAccounts(userId: string) {
    return this.connectedAccounts.list(userId);
  }

  unlinkProvider(userId: string, provider: "GOOGLE" | "GITHUB"): Promise<void> {
    return this.connectedAccounts.unlink(userId, provider);
  }
}
