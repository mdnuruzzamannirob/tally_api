import type { PrismaClient } from "../../../generated/prisma/client.js";

export type OAuthProvider = "GOOGLE" | "GITHUB";
export type OAuthIntent = "LOGIN" | "LINK";

export type OAuthStateRecord = {
  provider: OAuthProvider;
  intent: OAuthIntent;
  userId: string | null;
  expiresAt: Date;
};

export type LinkAccountResult =
  | "linked"
  | "already-linked"
  | "account-owned-by-another-user"
  | "provider-already-linked"
  | "missing-user";

/** Provider-neutral persistence boundary for OAuth state, accounts, and sessions. */
export class OAuthRepository {
  constructor(private readonly client: PrismaClient) {}

  createState(input: {
    provider: OAuthProvider;
    intent: OAuthIntent;
    userId: string | null;
    stateHash: string;
    expiresAt: Date;
  }): Promise<void> {
    return this.client.oAuthState
      .create({
        data: {
          provider: input.provider,
          intent: input.intent,
          userId: input.userId,
          stateHash: input.stateHash,
          expiresAt: input.expiresAt,
        },
      })
      .then(() => undefined);
  }

  consumeState(
    provider: OAuthProvider,
    stateHash: string,
    now: Date,
  ): Promise<OAuthStateRecord | null> {
    return this.client.$transaction(
      async (transaction) => {
        const record = await transaction.oAuthState.findUnique({ where: { stateHash } });
        if (!record) return null;

        if (record.provider !== provider || record.expiresAt <= now) {
          await transaction.oAuthState.delete({ where: { id: record.id } });
          return null;
        }

        const consumed = await transaction.oAuthState.deleteMany({ where: { id: record.id } });
        if (consumed.count !== 1) return null;

        return {
          provider: record.provider,
          intent: record.intent,
          userId: record.userId,
          expiresAt: record.expiresAt,
        };
      },
      { isolationLevel: "Serializable" },
    );
  }

  linkAccount(input: {
    userId: string;
    provider: OAuthProvider;
    providerAccountId: string;
    email: string;
  }): Promise<LinkAccountResult> {
    return this.client.$transaction(
      async (transaction) => {
        const user = await transaction.user.findUnique({
          where: { id: input.userId },
          select: { id: true },
        });
        if (!user) return "missing-user";

        const account = await transaction.oauthAccount.findUnique({
          where: {
            provider_providerAccountId: {
              provider: input.provider,
              providerAccountId: input.providerAccountId,
            },
          },
          select: { userId: true },
        });
        if (account?.userId === input.userId) return "already-linked";
        if (account) return "account-owned-by-another-user";

        const providerForUser = await transaction.oauthAccount.findUnique({
          where: { userId_provider: { userId: input.userId, provider: input.provider } },
          select: { id: true },
        });
        if (providerForUser) return "provider-already-linked";

        await transaction.oauthAccount.create({
          data: {
            userId: input.userId,
            provider: input.provider,
            providerAccountId: input.providerAccountId,
            email: input.email,
          },
        });
        return "linked";
      },
      { isolationLevel: "Serializable" },
    );
  }

  resolveUser(input: {
    provider: OAuthProvider;
    providerAccountId: string;
    email: string;
    name: string | null;
    verifiedAt: Date;
  }): Promise<{ userId: string }> {
    return this.client.$transaction(
      async (transaction) => {
        const account = await transaction.oauthAccount.findUnique({
          where: {
            provider_providerAccountId: {
              provider: input.provider,
              providerAccountId: input.providerAccountId,
            },
          },
          select: { userId: true },
        });
        if (account) return { userId: account.userId };

        let user = await transaction.user.findUnique({ where: { email: input.email } });
        if (!user) {
          user = await transaction.user.create({
            data: {
              name: input.name,
              email: input.email,
              emailVerified: true,
              emailVerifiedAt: input.verifiedAt,
            },
          });
        } else if (!user.emailVerified) {
          user = await transaction.user.update({
            where: { id: user.id },
            data: { emailVerified: true, emailVerifiedAt: input.verifiedAt },
          });
        }

        await transaction.oauthAccount.create({
          data: {
            userId: user.id,
            provider: input.provider,
            providerAccountId: input.providerAccountId,
            email: input.email,
          },
        });
        return { userId: user.id };
      },
      { isolationLevel: "Serializable" },
    );
  }

  createRefreshSession(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    return this.client.refreshToken
      .create({
        data: {
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
        },
      })
      .then(() => undefined);
  }
}
