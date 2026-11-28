import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestPrismaClient, clearTestDatabase } from "../../helpers/db.js";
import { NotificationRepository } from "../../../src/modules/notifications/notifications.repository.js";

describe.skipIf(!process.env.TEST_DATABASE_URL)("reminder lifecycle", () => {
  let client: ReturnType<typeof createTestPrismaClient>;
  let repository: NotificationRepository;
  beforeAll(() => {
    client = createTestPrismaClient();
    repository = new NotificationRepository(client);
  });
  beforeEach(async () => {
    await clearTestDatabase(client);
  });
  afterAll(async () => {
    await clearTestDatabase(client);
    await client.$disconnect();
  });

  it("formats future interviews in the owner's timezone and skips archived applications", async () => {
    const user = await client.user.create({
      data: { email: "timezone@example.test", timeZone: "Asia/Dhaka" },
    });
    const app = await client.application.create({
      data: { userId: user.id, company: "Timezone", role: "Engineer" },
    });
    const interview = await client.interview.create({
      data: {
        applicationId: app.id,
        type: "PHONE",
        scheduledAt: new Date("2030-01-02T12:00:00.000Z"),
      },
    });
    const now = new Date("2030-01-02T11:00:00.000Z");
    await repository.collectReminders(now);
    const item = await client.notification.findFirstOrThrow({ where: { userId: user.id } });
    expect(item.body).toContain("6:00 PM");
    expect(item.body).toContain("Asia/Dhaka");
    await client.application.update({ where: { id: app.id }, data: { archivedAt: now } });
    expect(await repository.isRelevant(item.eventKey, now)).toBe(false);
    await client.notification.deleteMany({ where: { userId: user.id } });
    await repository.collectReminders(now);
    expect(await client.notification.count({ where: { userId: user.id } })).toBe(0);
    expect(interview.status).toBe("SCHEDULED");
  });

  it("reclaims an expired lease but permanently fails an exhausted job", async () => {
    const user = await client.user.create({ data: { email: "leases@example.test" } });
    const now = new Date("2030-01-01T00:00:00.000Z");
    const leased = await client.notification.create({
      data: {
        userId: user.id,
        eventKey: "lease",
        title: "Lease",
        body: "Fixture",
        href: "/settings",
        attempts: 1,
        nextAttemptAt: new Date(now.getTime() + 1_000),
      },
    });
    const exhausted = await client.notification.create({
      data: {
        userId: user.id,
        eventKey: "exhausted",
        title: "Exhausted",
        body: "Fixture",
        href: "/settings",
        attempts: 5,
        nextAttemptAt: now,
      },
    });
    expect(await repository.claim(now)).toHaveLength(0);
    expect(
      (await client.notification.findUniqueOrThrow({ where: { id: exhausted.id } })).emailStatus,
    ).toBe("FAILED");
    const jobs = await repository.claim(new Date(now.getTime() + 1_001));
    expect(jobs.map((job) => job.id)).toEqual([leased.id]);
    expect(jobs[0]!.attempts).toBe(2);
    expect(await repository.claim(new Date(now.getTime() + 1_002))).toHaveLength(0);
  });
});
