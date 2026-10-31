import { ApiError } from "../../../core/errors/api-error.js";
import type { PrismaClient } from "../../../generated/prisma/client.js";

export class EmailVerificationRepository {
  constructor(private readonly client: PrismaClient) {}

  createUser(input: {
    name: string | null;
    email: string;
    passwordHash: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return this.client.$transaction(async (transaction) => {
      const user = await transaction.user
        .create({
          data: { name: input.name, email: input.email, passwordHash: input.passwordHash },
        })
        .catch((error: unknown) => {
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "P2002"
          ) {
            throw new ApiError(409, "CONFLICT", "An account with this email already exists.");
          }
          throw error;
        });
      await transaction.emailVerificationToken.create({
        data: { userId: user.id, tokenHash: input.tokenHash, expiresAt: input.expiresAt },
      });
    });
  }

  async pruneDeliveredTokens(userId: string, tokenHash: string) {
    const delivered = await this.client.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (!delivered) return;
    await this.client.emailVerificationToken.deleteMany({
      where: { userId, createdAt: { lt: delivered.createdAt } },
    });
  }

  findToken(tokenHash: string) {
    return this.client.emailVerificationToken.findUnique({ where: { tokenHash } });
  }

  verifyUser(userId: string, verifiedAt: Date, tokenHash: string) {
    return this.client.$transaction(async (transaction) => {
      // Serialize verification and recheck expiry when consuming the credential.
      await transaction.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      const consumed = await transaction.emailVerificationToken.deleteMany({
        where: { userId, tokenHash, expiresAt: { gt: verifiedAt } },
      });
      if (consumed.count !== 1) return false;
      await transaction.user.update({
        where: { id: userId },
        data: { emailVerified: true, emailVerifiedAt: verifiedAt },
      });
      await transaction.emailVerificationToken.deleteMany({ where: { userId } });
      return true;
    });
  }

  replaceToken(userId: string, tokenHash: string, expiresAt: Date) {
    return this.client.$transaction([
      this.client.emailVerificationToken.deleteMany({
        where: { userId, expiresAt: { lte: new Date() } },
      }),
      this.client.emailVerificationToken.create({ data: { userId, tokenHash, expiresAt } }),
    ]);
  }
}
