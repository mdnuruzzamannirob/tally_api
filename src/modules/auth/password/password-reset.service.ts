import { authConfig } from "../../../core/config/auth.config.js";
import { ApiError } from "../../../core/errors/api-error.js";
import { generateOpaqueToken, hashToken } from "../../../core/security/crypto.js";
import { hashPassword } from "../../../core/security/password.js";
import type { EmailService } from "../../../email/email.types.js";
import type { AuthRepository } from "../auth.repository.js";
import type { PasswordResetRepository } from "./password-reset.repository.js";

export class PasswordResetService {
  constructor(
    private readonly users: AuthRepository,
    private readonly repository: PasswordResetRepository,
    private readonly emailService: EmailService,
  ) {}

  async request(email: string): Promise<void> {
    const user = await this.users.findUserByEmail(email);
    if (!user) return;
    const rawToken = generateOpaqueToken();
    await this.repository.replaceToken(
      user.id,
      hashToken(rawToken),
      new Date(Date.now() + authConfig.passwordResetTokenLifetimeMs),
    );
    await this.emailService.sendPasswordResetEmail({ email: user.email, token: rawToken });
  }

  async reset(rawToken: string, password: string): Promise<void> {
    const token = await this.repository.findToken(hashToken(rawToken));
    if (!token || token.usedAt || token.expiresAt <= new Date()) {
      throw new ApiError(
        400,
        "INVALID_OR_EXPIRED_TOKEN",
        "Password reset token is invalid or expired.",
      );
    }
    const consumed = await this.repository.consumeAndUpdatePassword(
      token.id,
      token.userId,
      await hashPassword(password),
      new Date(),
    );
    if (!consumed) {
      throw new ApiError(
        400,
        "INVALID_OR_EXPIRED_TOKEN",
        "Password reset token is invalid or expired.",
      );
    }
  }
}
