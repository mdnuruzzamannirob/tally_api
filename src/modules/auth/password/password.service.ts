import { ApiError } from "../../../core/errors/api-error.js";
import { hashToken } from "../../../core/security/crypto.js";
import { hashPassword, verifyPassword } from "../../../core/security/password.js";
import type { AuthRepository } from "../auth.repository.js";
import type { PasswordResetRepository } from "./password-reset.repository.js";
import type { ChangePasswordInput } from "./password.validators.js";

export class PasswordService {
  constructor(
    private readonly users: AuthRepository,
    private readonly repository: PasswordResetRepository,
  ) {}

  async change(
    userId: string,
    input: ChangePasswordInput,
    currentRefreshToken: string | undefined,
  ): Promise<void> {
    const user = await this.users.findUserById(userId);
    if (!user) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
    if (!user.passwordHash) {
      throw new ApiError(409, "CONFLICT", "Use the set-password flow for this account.");
    }
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Current password is incorrect.");
    }
    await this.repository.updateAndRevokeOtherSessions(
      userId,
      await hashPassword(input.newPassword),
      currentRefreshToken ? hashToken(currentRefreshToken) : undefined,
      new Date(),
    );
  }

  async set(userId: string, password: string): Promise<void> {
    const user = await this.users.findUserById(userId);
    if (!user) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
    if (user.passwordHash) {
      throw new ApiError(409, "CONFLICT", "Use the change-password flow for this account.");
    }
    await this.repository.setPassword(userId, await hashPassword(password));
  }
}
