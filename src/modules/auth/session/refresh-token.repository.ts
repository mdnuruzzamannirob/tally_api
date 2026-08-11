import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { CreateRefreshTokenInput, RotateRefreshTokenInput } from "./refresh-token.types.js";

export class RefreshTokenRepository {
  constructor(private readonly client: PrismaClient) {}

  create(input: CreateRefreshTokenInput) {
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

  find(tokenHash: string) {
    return this.client.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
  }

  rotate(input: RotateRefreshTokenInput) {
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

  revoke(tokenHash: string, revokedAt: Date) {
    return this.client.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt },
    });
  }

  revokeAll(userId: string, revokedAt: Date) {
    return this.client.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt },
    });
  }
}
