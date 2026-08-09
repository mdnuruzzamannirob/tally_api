import type { PrismaClient } from "../../src/generated/prisma/client.js";

let fixtureSequence = 0;

function nextSuffix(): string {
  fixtureSequence += 1;
  return `${Date.now()}-${fixtureSequence}`;
}

export async function createTestUser(prisma: PrismaClient) {
  const suffix = nextSuffix();
  return prisma.user.create({
    data: {
      email: `user-${suffix}@example.test`,
      passwordHash: "$2b$12$test-fixture-password-hash",
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
}

export async function createTestApplication(prisma: PrismaClient, userId: string) {
  return prisma.application.create({
    data: { userId, company: "Fixture Company", role: "Fixture Role" },
  });
}

export async function createTestTag(prisma: PrismaClient, userId: string) {
  return prisma.tag.create({ data: { userId, name: `tag-${nextSuffix()}` } });
}
