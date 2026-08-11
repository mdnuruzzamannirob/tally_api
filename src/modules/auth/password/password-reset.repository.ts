import type { PrismaClient } from "../../../generated/prisma/client.js";

export class PasswordResetRepository {
  constructor(private readonly client: PrismaClient) {}

  replaceToken(userId: string, tokenHash: string, expiresAt: Date) {
    return this.client.$transaction([
      this.client.passwordResetToken.deleteMany({ where: { userId, usedAt: null } }),
      this.client.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } }),
    ]);
  }

  findToken(tokenHash: string) {
    return this.client.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  consumeAndUpdatePassword(tokenId: string, userId: string, passwordHash: string, usedAt: Date) {
    return this.client.$transaction(async (transaction) => {
      const consumed = await transaction.passwordResetToken.updateMany({
        where: { id: tokenId, usedAt: null },
        data: { usedAt },
      });
      if (consumed.count !== 1) return false;
      await transaction.user.update({ where: { id: userId }, data: { passwordHash } });
      await transaction.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: usedAt },
      });
      return true;
    });
  }

  updateAndRevokeOtherSessions(
    userId: string,
    passwordHash: string,
    currentTokenHash: string | undefined,
    revokedAt: Date,
  ) {
    return this.client.$transaction([
      this.client.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.client.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}),
        },
        data: { revokedAt },
      }),
    ]);
  }

  setPassword(userId: string, passwordHash: string) {
    return this.client.user.update({ where: { id: userId }, data: { passwordHash } });
  }
}
