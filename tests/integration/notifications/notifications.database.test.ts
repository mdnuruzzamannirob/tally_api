import { AuthRepository } from "../../../src/modules/auth/auth.repository.js";
import { EmailVerificationService } from "../../../src/modules/auth/verification/email-verification.service.js";
import { PasswordResetService } from "../../../src/modules/auth/password/password-reset.service.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../src/generated/prisma/client.js";
import { NotificationRepository } from "../../../src/modules/notifications/notifications.repository.js";
import { InterviewRepository } from "../../../src/modules/interviews/interviews.repository.js";
import { PasswordResetRepository } from "../../../src/modules/auth/password/password-reset.repository.js";
import { EmailVerificationRepository } from "../../../src/modules/auth/verification/email-verification.repository.js";

const url = process.env.TEST_DATABASE_URL;
const suffix = `notifications-${Date.now()}`;
let client: PrismaClient;
let repository: NotificationRepository;
let userId: string;
let otherId: string;
let applicationId: string;
describe.skipIf(!url)("persistent notification and recovery behavior", () => {
  beforeAll(async () => {
    client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    repository = new NotificationRepository(client);
    const user = await client.user.create({
      data: {
        email: `${suffix}@example.test`,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        notificationsEnabled: true,
      },
    });
    userId = user.id;
    otherId = (await client.user.create({ data: { email: `${suffix}-other@example.test` } })).id;
    applicationId = (
      await client.application.create({
        data: {
          userId,
          company: "Example",
          role: "Engineer",
          nextFollowUpAt: new Date(Date.now() - 60000),
        },
      })
    ).id;
  });
  afterAll(async () => {
    await client.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
    await client.$disconnect();
  });
  it("creates interview alerts atomically and deduplicates recurring reminders", async () => {
    const interviews = new InterviewRepository(client);
    const result = await interviews.create(userId, applicationId, {
      type: "PHONE",
      scheduledAt: new Date(Date.now() + 3600000),
    });
    expect(result.kind).toBe("created");
    await repository.collectReminders(new Date());
    await repository.collectReminders(new Date());
    const list = await repository.list(userId);
    expect(list.items.filter((item) => item.title === "Upcoming interview")).toHaveLength(1);
    expect(list.items.filter((item) => item.title === "Follow-up due")).toHaveLength(1);
    expect(list.items.some((item) => item.title === "Interview scheduled")).toBe(true);
    if (result.kind === "created") {
      await interviews.update(userId, result.interview.id, { status: "CANCELLED" });
      const reminder = await client.notification.findFirstOrThrow({
        where: { userId, title: "Upcoming interview" },
      });
      expect(await repository.isRelevant(reminder.eventKey, new Date())).toBe(false);
    }
  });
  it("isolates notification ownership and read state", async () => {
    const list = await repository.list(userId);
    const first = list.items[0]!;
    await repository.markRead(otherId, first.id);
    expect((await repository.list(userId)).unread).toBe(list.unread);
    expect((await repository.list(otherId)).items).toHaveLength(0);
    await repository.markRead(userId, first.id);
    expect((await repository.list(userId)).unread).toBe(list.unread - 1);
  });
  it("leases each queued email to only one concurrent worker", async () => {
    const [a, b] = await Promise.all([repository.claim(new Date()), repository.claim(new Date())]);
    const ids = [...a, ...b].map((item) => item.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("preserves delivered links when replacement email delivery actually fails", async () => {
    const expiry = new Date(Date.now() + 600000);
    const users = new AuthRepository(client);
    const verification = new EmailVerificationRepository(client);
    const passwords = new PasswordResetRepository(client);
    const email = {
      sendVerificationEmail: async () => {
        throw new Error("provider unavailable");
      },
      sendPasswordResetEmail: async () => {
        throw new Error("provider unavailable");
      },
    };
    await verification.replaceToken(otherId, `${suffix}-failed-verify`, expiry);
    await passwords.replaceToken(otherId, `${suffix}-failed-reset`, expiry);
    const other = await client.user.findUniqueOrThrow({ where: { id: otherId } });
    await expect(
      new EmailVerificationService(users, verification, email).resend(other.email),
    ).rejects.toThrow("provider unavailable");
    await expect(
      new PasswordResetService(users, passwords, email).request(other.email),
    ).rejects.toThrow("provider unavailable");
    expect(await verification.findToken(`${suffix}-failed-verify`)).not.toBeNull();
    expect(await passwords.findToken(`${suffix}-failed-reset`)).not.toBeNull();
  });
  it("invalidates outstanding recovery links when changing a password", async () => {
    const passwords = new PasswordResetRepository(client);
    const expiry = new Date(Date.now() + 600000);
    await passwords.replaceToken(userId, `${suffix}-before-change`, expiry);
    await passwords.updateAndRevokeOtherSessions(
      userId,
      "changed-password-hash",
      undefined,
      new Date(),
    );
    const token = await passwords.findToken(`${suffix}-before-change`);
    expect(token!.usedAt).not.toBeNull();
    expect(
      await passwords.consumeAndUpdatePassword(
        token!.id,
        userId,
        "stale-password-hash",
        new Date(),
      ),
    ).toBe(false);
  });
  it("keeps old verification/reset links valid after issuing a new link", async () => {
    const expiry = new Date(Date.now() + 600000);
    const verification = new EmailVerificationRepository(client);
    await verification.replaceToken(userId, `${suffix}-verify1`, expiry);
    await verification.replaceToken(userId, `${suffix}-verify2`, expiry);
    expect(await verification.findToken(`${suffix}-verify1`)).not.toBeNull();
    const reset = new PasswordResetRepository(client);
    await reset.replaceToken(userId, `${suffix}-reset1`, expiry);
    await reset.replaceToken(userId, `${suffix}-reset2`, expiry);
    const first = await reset.findToken(`${suffix}-reset1`);
    const second = await reset.findToken(`${suffix}-reset2`);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    const consumed = await Promise.all([
      reset.consumeAndUpdatePassword(first!.id, userId, "test-password-hash", new Date()),
      reset.consumeAndUpdatePassword(second!.id, userId, "test-password-hash", new Date()),
    ]);
    expect(consumed.filter(Boolean)).toHaveLength(1);
    expect(
      await client.notification.count({
        where: { userId, title: "Your password was reset", required: true },
      }),
    ).toBe(1);
  });
});
