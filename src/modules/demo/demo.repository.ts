import { prisma } from "../../core/database/prisma.js";
import { ApiError } from "../../core/errors/api-error.js";
import { DEMO_DOMAIN, seedDemoWorkspace } from "./demo.fixture.js";
import { DEMO_LIFETIME_MS } from "./demo.fixture.js";

export const findDemoUser = (id: string) => prisma.user.findUnique({ where: { id } });
export const deleteDemoUser = (id: string) => prisma.user.delete({ where: { id } });

export async function createDemoUser(email: string, passwordHash: string) {
  const user = await prisma.$transaction(
    async (tx) => {
      // Cross-process capacity guard. All creation and cleanup use the same lock.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(81300421)::text`;
      await tx.user.deleteMany({
        where: {
          email: { endsWith: DEMO_DOMAIN },
          createdAt: { lt: new Date(Date.now() - DEMO_LIFETIME_MS) },
        },
      });
      if ((await tx.user.count({ where: { email: { endsWith: DEMO_DOMAIN } } })) >= 100) {
        throw new ApiError(
          503,
          "DEMO_BUSY",
          "Demo capacity is full. Please try again later or view the walkthrough.",
        );
      }
      const created = await tx.user.create({
        data: {
          name: "Demo Visitor",
          email,
          passwordHash,
          emailVerified: true,
          emailVerifiedAt: new Date(),
          notificationsEnabled: false,
        },
      });
      await seedDemoWorkspace(tx, created.id);
      return created;
    },
    { timeout: 15_000 },
  );
  return user;
}
export async function resetDemoUser(userId: string) {
  await prisma.$transaction(
    async (tx) => {
      // Serialize two reset requests for the same visitor, never other visitors.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      await seedDemoWorkspace(tx, userId);
    },
    { timeout: 15_000 },
  );
}
