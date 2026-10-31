import { authConfig } from "../../../core/config/auth.config.js";
import { ApiError } from "../../../core/errors/api-error.js";
import { generateOpaqueToken, hashToken } from "../../../core/security/crypto.js";
import { hashPassword, verifyPassword } from "../../../core/security/password.js";
import type { EmailService } from "../../../email/email.types.js";
import type { AuthRepository } from "../auth.repository.js";
import type { RegisterInput } from "../auth.validators.js";
import type { EmailVerificationRepository } from "./email-verification.repository.js";

export class EmailVerificationService {
  constructor(
    private readonly users: AuthRepository,
    private readonly repository: EmailVerificationRepository,
    private readonly emailService: EmailService,
  ) {}

  async register(input: RegisterInput): Promise<void> {
    const existingUser = await this.users.findUserByEmail(input.email);
    if (existingUser) {
      // Recover registrations whose account was saved before email delivery failed.
      // Never change an existing account's password or profile during a retry.
      if (
        !existingUser.emailVerified &&
        existingUser.passwordHash &&
        (await verifyPassword(input.password, existingUser.passwordHash))
      ) {
        await this.resend(input.email);
        return;
      }
      throw new ApiError(409, "CONFLICT", "An account with this email already exists.");
    }
    const rawToken = generateOpaqueToken();
    await this.repository.createUser({
      name: input.name ?? null,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + authConfig.verificationTokenLifetimeMs),
    });
    await this.emailService.sendVerificationEmail({ email: input.email, token: rawToken });
  }

  async verify(rawToken: string): Promise<void> {
    const token = await this.repository.findToken(hashToken(rawToken));
    if (!token || token.expiresAt <= new Date()) {
      throw new ApiError(
        400,
        "INVALID_OR_EXPIRED_TOKEN",
        "Verification token is invalid or expired.",
      );
    }
    const consumed = await this.repository.verifyUser(
      token.userId,
      new Date(),
      hashToken(rawToken),
    );
    if (!consumed) {
      throw new ApiError(
        400,
        "INVALID_OR_EXPIRED_TOKEN",
        "Verification token is invalid or expired.",
      );
    }
  }

  async resend(email: string): Promise<void> {
    const user = await this.users.findUserByEmail(email);
    if (!user || user.emailVerified) return;
    const rawToken = generateOpaqueToken();
    await this.repository.replaceToken(
      user.id,
      hashToken(rawToken),
      new Date(Date.now() + authConfig.verificationTokenLifetimeMs),
    );
    await this.emailService.sendVerificationEmail({ email: user.email, token: rawToken });
    await this.repository.pruneDeliveredTokens(user.id, hashToken(rawToken));
  }
}
