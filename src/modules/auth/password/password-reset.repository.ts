import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../../generated/prisma/client.js";

export class PasswordResetRepository {
  constructor(private readonly client: PrismaClient) {}

  replaceToken(userId: string, tokenHash: string, expiresAt: Date) {
    return this.client.$transaction([
      this.client.passwordResetToken.deleteMany({
        where: { userId, expiresAt: { lte: new Date() } },
      }),
      this.client.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } }),
    ]);
  }

  async pruneDeliveredTokens(userId: string, tokenHash: string) {
    const delivered = await this.client.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!delivered) return;
    await this.client.passwordResetToken.deleteMany({
      where: { userId, createdAt: { lt: delivered.createdAt } },
    });
  }

  findToken(tokenHash: string) {
    return this.client.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  consumeAndUpdatePassword(tokenId: string, userId: string, passwordHash: string, usedAt: Date) {
    return this.client.$transaction(async (transaction) => {
      // Serialize sibling token consumption on the user row.
      await transaction.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      const consumed = await transaction.passwordResetToken.updateMany({
        where: { id: tokenId, usedAt: null, expiresAt: { gt: usedAt } },
        data: { usedAt },
      });
      if (consumed.count !== 1) return false;
      await transaction.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt },
      });
      await transaction.user.update({ where: { id: userId }, data: { passwordHash } });
      await transaction.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: usedAt },
      });
      await transaction.notification.create({
        data: {
          userId,
          eventKey: `password-reset:${tokenId}`,
          title: "Your password was reset",
          body: "Your Tally password was reset and existing sessions were signed out. If this wasn't you, reset your password immediately.",
          href: "/settings",
          required: true,
        },
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
      this.client.notification.create({
        data: {
          userId,
          eventKey: `password-change:${randomUUID()}`,
          title: "Your password was changed",
          body: "Your Tally password was changed. If this wasn't you, reset your password immediately.",
          href: "/settings",
          required: true,
        },
      }),
      this.client.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.client.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
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
    return this.client.$transaction([
      this.client.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.client.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.client.notification.create({
        data: {
          userId,
          eventKey: `password-set:${randomUUID()}`,
          title: "A password was added to your account",
          body: "Email and password sign-in is now enabled for your Tally account. If this wasn't you, reset your password immediately.",
          href: "/settings",
          required: true,
        },
      }),
    ]);
  }
}
