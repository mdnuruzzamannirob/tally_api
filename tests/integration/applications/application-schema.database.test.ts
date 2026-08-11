import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../src/generated/prisma/client.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const runDatabaseTests = Boolean(testDatabaseUrl);
const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

let prisma: PrismaClient;

describe.skipIf(!runDatabaseTests)("application data schema", () => {
  beforeAll(() => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: testDatabaseUrl! }),
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: uniqueSuffix } } });
    await prisma.$disconnect();
  });

  it("enforces constraints, indexes, cascades, and archival fields", async () => {
    const user = await prisma.user.create({
      data: { email: `application-${uniqueSuffix}@example.test` },
    });
    const archivedAt = new Date();
    const application = await prisma.application.create({
      data: {
        userId: user.id,
        company: "Tally",
        role: "Engineer",
        salaryMin: 1000,
        salaryMax: 1500,
        currency: "USD",
        archivedAt,
      },
    });
    expect(application.archivedAt).toEqual(archivedAt);

    const tag = await prisma.tag.create({
      data: { userId: user.id, name: `priority-${uniqueSuffix}` },
    });
    await expect(
      prisma.tag.create({ data: { userId: user.id, name: `priority-${uniqueSuffix}` } }),
    ).rejects.toMatchObject({ code: "P2002" });
    await prisma.applicationTag.create({ data: { applicationId: application.id, tagId: tag.id } });
    await prisma.note.create({
      data: { applicationId: application.id, content: "Follow up next week." },
    });
    await prisma.interview.create({
      data: { applicationId: application.id, type: "TECHNICAL", scheduledAt: new Date() },
    });
    await prisma.statusHistory.create({
      data: { applicationId: application.id, fromStatus: "WISHLIST", toStatus: "APPLIED" },
    });

    await expect(
      prisma.application.create({
        data: { userId: user.id, company: "Invalid", role: "Role", salaryMin: -1, currency: "USD" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.application.create({
        data: {
          userId: user.id,
          company: "Invalid",
          role: "Role",
          salaryMin: 200,
          salaryMax: 100,
          currency: "USD",
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.application.create({
        data: { userId: user.id, company: "Invalid", role: "Role", salaryMin: 100 },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.application.create({
        data: { userId: user.id, company: "Invalid", role: "Role", currency: "usd" },
      }),
    ).rejects.toThrow();
    await expect(prisma.tag.create({ data: { userId: user.id, name: "" } })).rejects.toThrow();
    await expect(
      prisma.note.create({ data: { applicationId: application.id, content: "x".repeat(5001) } }),
    ).rejects.toThrow();

    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename IN ('applications', 'notes', 'interviews', 'status_history')
    `;
    expect(indexes.map(({ indexname }) => indexname)).toEqual(
      expect.arrayContaining([
        "applications_user_id_status_idx",
        "notes_application_id_created_at_idx",
        "interviews_application_id_scheduled_at_idx",
        "status_history_application_id_changed_at_idx",
      ]),
    );

    await prisma.application.delete({ where: { id: application.id } });
    await expect(
      Promise.all([
        prisma.applicationTag.count({ where: { applicationId: application.id } }),
        prisma.note.count({ where: { applicationId: application.id } }),
        prisma.interview.count({ where: { applicationId: application.id } }),
        prisma.statusHistory.count({ where: { applicationId: application.id } }),
      ]),
    ).resolves.toEqual([0, 0, 0, 0]);

    const secondApplication = await prisma.application.create({
      data: { userId: user.id, company: "Tally", role: "Designer" },
    });
    await prisma.applicationTag.create({
      data: { applicationId: secondApplication.id, tagId: tag.id },
    });
    await prisma.tag.delete({ where: { id: tag.id } });
    await expect(
      prisma.applicationTag.count({ where: { applicationId: secondApplication.id } }),
    ).resolves.toBe(0);
  });
});
