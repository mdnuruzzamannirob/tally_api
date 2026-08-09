import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const runDatabaseTests = Boolean(testDatabaseUrl);
const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

let prisma: PrismaClient;

describe.skipIf(!runDatabaseTests)("core user and auth schema", () => {
  beforeAll(() => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: testDatabaseUrl! }),
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: uniqueSuffix } } });
    await prisma.$disconnect();
  });

  it("enforces email verification, account, and token uniqueness", async () => {
    const email = `schema-${uniqueSuffix}@example.test`;
    const user = await prisma.user.create({ data: { email } });

    await expect(prisma.user.create({ data: { email } })).rejects.toMatchObject({ code: "P2002" });
    await expect(
      prisma.user.create({
        data: {
          email: `inconsistent-${uniqueSuffix}@example.test`,
          emailVerified: true,
        },
      }),
    ).rejects.toThrow();

    await prisma.oauthAccount.create({
      data: { userId: user.id, provider: "GOOGLE", providerAccountId: `google-${uniqueSuffix}` },
    });
    await expect(
      prisma.oauthAccount.create({
        data: { userId: user.id, provider: "GOOGLE", providerAccountId: `other-${uniqueSuffix}` },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    const otherUser = await prisma.user.create({
      data: { email: `other-${uniqueSuffix}@example.test` },
    });
    await expect(
      prisma.oauthAccount.create({
        data: {
          userId: otherUser.id,
          provider: "GOOGLE",
          providerAccountId: `google-${uniqueSuffix}`,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    const expiresAt = new Date(Date.now() + 60_000);
    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: `refresh-${uniqueSuffix}`, expiresAt },
    });
    await prisma.emailVerificationToken.create({
      data: { userId: user.id, tokenHash: `verify-${uniqueSuffix}`, expiresAt },
    });
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: `reset-${uniqueSuffix}`, expiresAt },
    });
    await expect(
      prisma.refreshToken.create({
        data: { userId: user.id, tokenHash: `refresh-${uniqueSuffix}`, expiresAt },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    await prisma.user.delete({ where: { id: user.id } });
    await expect(
      Promise.all([
        prisma.oauthAccount.count({ where: { userId: user.id } }),
        prisma.refreshToken.count({ where: { userId: user.id } }),
        prisma.emailVerificationToken.count({ where: { userId: user.id } }),
        prisma.passwordResetToken.count({ where: { userId: user.id } }),
      ]),
    ).resolves.toEqual([0, 0, 0, 0]);

    await prisma.user.delete({ where: { id: otherUser.id } });
  });
});
