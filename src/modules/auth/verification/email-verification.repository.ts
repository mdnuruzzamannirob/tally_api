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
      const user = await transaction.user.create({
        data: { name: input.name, email: input.email, passwordHash: input.passwordHash },
      });
      await transaction.emailVerificationToken.create({
        data: { userId: user.id, tokenHash: input.tokenHash, expiresAt: input.expiresAt },
      });
    });
  }

  findToken(tokenHash: string) {
    return this.client.emailVerificationToken.findUnique({ where: { tokenHash } });
  }

  verifyUser(userId: string, verifiedAt: Date) {
    return this.client.$transaction([
      this.client.user.update({
        where: { id: userId },
        data: { emailVerified: true, emailVerifiedAt: verifiedAt },
      }),
      this.client.emailVerificationToken.deleteMany({ where: { userId } }),
    ]);
  }

  replaceToken(userId: string, tokenHash: string, expiresAt: Date) {
    return this.client.$transaction([
      this.client.emailVerificationToken.deleteMany({ where: { userId } }),
      this.client.emailVerificationToken.create({ data: { userId, tokenHash, expiresAt } }),
    ]);
  }
}
