import type { PrismaClient } from "../../generated/prisma/client.js";

/**
 * Auth persistence boundary. Phase 1 services receive this repository rather
 * than the application-wide Prisma client so feature data access has one home.
 */
export class AuthRepository {
  constructor(readonly client: PrismaClient) {}

  findUserByEmail(email: string) {
    return this.client.user.findUnique({ where: { email }, include: { oauthAccounts: true } });
  }

  findUserById(userId: string) {
    return this.client.user.findUnique({ where: { id: userId }, include: { oauthAccounts: true } });
  }

  createUserWithVerification(input: {
    name: string | null;
    email: string;
    passwordHash: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return this.client.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: { name: input.name, email: input.email, passwordHash: input.passwordHash },
      });
      await transaction.emailVerificationToken.create({
        data: { userId: user.id, tokenHash: input.tokenHash, expiresAt: input.expiresAt },
      });
    });
  }

  findVerificationToken(tokenHash: string) {
    return this.client.emailVerificationToken.findUnique({ where: { tokenHash } });
  }

  verifyUserAndClearVerificationTokens(userId: string, verifiedAt: Date) {
    return this.client.$transaction([
      this.client.user.update({
        where: { id: userId },
        data: { emailVerified: true, emailVerifiedAt: verifiedAt },
      }),
      this.client.emailVerificationToken.deleteMany({ where: { userId } }),
    ]);
  }

  replaceVerificationToken(userId: string, tokenHash: string, expiresAt: Date) {
    return this.client.$transaction([
      this.client.emailVerificationToken.deleteMany({ where: { userId } }),
      this.client.emailVerificationToken.create({ data: { userId, tokenHash, expiresAt } }),
    ]);
  }

  createRefreshSession(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string | undefined;
    ip?: string | undefined;
  }) {
    return this.client.refreshToken.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        userAgent: input.userAgent ?? null,
        ip: input.ip ?? null,
      },
    });
  }

  findRefreshSession(tokenHash: string) {
    return this.client.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
  }

  rotateRefreshSession(input: {
    id: string;
    userId: string;
    nextTokenHash: string;
    expiresAt: Date;
    revokedAt: Date;
    userAgent?: string | undefined;
    ip?: string | undefined;
  }) {
    return this.client.$transaction(async (transaction) => {
      const revoked = await transaction.refreshToken.updateMany({
        where: { id: input.id, revokedAt: null },
        data: { revokedAt: input.revokedAt, replacedByHash: input.nextTokenHash },
      });
      if (revoked.count !== 1) return false;
      await transaction.refreshToken.create({
        data: {
          userId: input.userId,
          tokenHash: input.nextTokenHash,
          expiresAt: input.expiresAt,
          userAgent: input.userAgent ?? null,
          ip: input.ip ?? null,
        },
      });
      return true;
    });
  }

  revokeRefreshSession(tokenHash: string, revokedAt: Date) {
    return this.client.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt },
    });
  }

  revokeUserSessions(userId: string, revokedAt: Date) {
    return this.client.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt },
    });
  }

  replacePasswordResetToken(userId: string, tokenHash: string, expiresAt: Date) {
    return this.client.$transaction([
      this.client.passwordResetToken.deleteMany({ where: { userId, usedAt: null } }),
      this.client.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } }),
    ]);
  }

  findPasswordResetToken(tokenHash: string) {
    return this.client.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  consumePasswordResetAndUpdatePassword(
    tokenId: string,
    userId: string,
    passwordHash: string,
    usedAt: Date,
  ) {
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

  updatePasswordAndRevokeOtherSessions(
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

  findUserWithConnectedAccounts(userId: string) {
    return this.client.user.findUnique({ where: { id: userId }, include: { oauthAccounts: true } });
  }

  unlinkConnectedAccount(userId: string, provider: "GOOGLE" | "GITHUB") {
    return this.client.$transaction(
      async (transaction) => {
        const user = await transaction.user.findUnique({
          where: { id: userId },
          include: { oauthAccounts: true },
        });
        if (!user) return { kind: "missing-user" as const };
        const account = user.oauthAccounts.find((item) => item.provider === provider);
        if (!account) return { kind: "missing-account" as const };
        if (user.oauthAccounts.length + Number(Boolean(user.passwordHash)) <= 1)
          return { kind: "last-login-method" as const };
        await transaction.oauthAccount.delete({ where: { id: account.id } });
        return { kind: "unlinked" as const };
      },
      { isolationLevel: "Serializable" },
    );
  }
}
