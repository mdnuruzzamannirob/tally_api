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

  createUserWithVerification(input: { name: string | null; email: string; passwordHash: string; tokenHash: string; expiresAt: Date }) {
    return this.client.$transaction(async (transaction) => {
      const user = await transaction.user.create({ data: { name: input.name, email: input.email, passwordHash: input.passwordHash } });
      await transaction.emailVerificationToken.create({ data: { userId: user.id, tokenHash: input.tokenHash, expiresAt: input.expiresAt } });
    });
  }

  findVerificationToken(tokenHash: string) {
    return this.client.emailVerificationToken.findUnique({ where: { tokenHash } });
  }

  verifyUserAndClearVerificationTokens(userId: string, verifiedAt: Date) {
    return this.client.$transaction([
      this.client.user.update({ where: { id: userId }, data: { emailVerified: true, emailVerifiedAt: verifiedAt } }),
      this.client.emailVerificationToken.deleteMany({ where: { userId } }),
    ]);
  }

  replaceVerificationToken(userId: string, tokenHash: string, expiresAt: Date) {
    return this.client.$transaction([
      this.client.emailVerificationToken.deleteMany({ where: { userId } }),
      this.client.emailVerificationToken.create({ data: { userId, tokenHash, expiresAt } }),
    ]);
  }

  createRefreshSession(input: { userId: string; tokenHash: string; expiresAt: Date; userAgent?: string; ip?: string }) {
    return this.client.refreshToken.create({ data: { userId: input.userId, tokenHash: input.tokenHash, expiresAt: input.expiresAt, userAgent: input.userAgent ?? null, ip: input.ip ?? null } });
  }
}
