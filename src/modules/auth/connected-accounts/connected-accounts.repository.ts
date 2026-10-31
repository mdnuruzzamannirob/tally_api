import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../../generated/prisma/client.js";

export class ConnectedAccountsRepository {
  constructor(private readonly client: PrismaClient) {}

  findUser(userId: string) {
    return this.client.user.findUnique({ where: { id: userId }, include: { oauthAccounts: true } });
  }

  unlink(userId: string, provider: "GOOGLE" | "GITHUB") {
    return this.client.$transaction(
      async (transaction) => {
        const user = await transaction.user.findUnique({
          where: { id: userId },
          include: { oauthAccounts: true },
        });
        if (!user) return { kind: "missing-user" as const };
        const account = user.oauthAccounts.find((item) => item.provider === provider);
        if (!account) return { kind: "missing-account" as const };
        if (user.oauthAccounts.length + Number(Boolean(user.passwordHash)) <= 1) {
          return { kind: "last-login-method" as const };
        }
        await transaction.oauthAccount.delete({ where: { id: account.id } });
        await transaction.notification.create({
          data: {
            userId,
            eventKey: `provider-unlinked:${randomUUID()}`,
            title: "Sign-in account disconnected",
            body: `Your ${provider.toLowerCase()} account was disconnected from Tally. If this wasn't you, reset your password immediately.`,
            href: "/settings",
            required: true,
          },
        });
        return { kind: "unlinked" as const };
      },
      { isolationLevel: "Serializable" },
    );
  }
}
