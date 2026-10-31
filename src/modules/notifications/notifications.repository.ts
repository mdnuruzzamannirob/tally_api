import type { PrismaClient } from "../../generated/prisma/client.js";

export type NotificationInput = {
  userId: string;
  eventKey: string;
  title: string;
  body: string;
  href: string;
  required?: boolean;
};
export class NotificationRepository {
  constructor(private readonly client: PrismaClient) {}
  create(input: NotificationInput) {
    return this.client.notification.upsert({
      where: { eventKey: input.eventKey },
      create: input,
      update: {},
    });
  }
  async list(userId: string) {
    const [items, unread] = await this.client.$transaction([
      this.client.notification.findMany({
        where: { userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 50,
        select: { id: true, title: true, body: true, href: true, readAt: true, createdAt: true },
      }),
      this.client.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, unread };
  }
  markRead(userId: string, id?: string) {
    return this.client.notification.updateMany({
      where: { userId, readAt: null, ...(id ? { id } : {}) },
      data: { readAt: new Date() },
    });
  }
  async collectReminders(now: Date) {
    const interviews = await this.client.interview.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { gt: now, lte: new Date(now.getTime() + 24 * 3600_000) },
        application: { archivedAt: null },
      },
      include: { application: { include: { user: { select: { timeZone: true } } } } },
    });
    for (const interview of interviews) {
      const application = interview.application;
      const time = new Intl.DateTimeFormat("en", {
        timeZone: application.user.timeZone,
        dateStyle: "medium",
        timeStyle: "short",
      }).format(interview.scheduledAt);
      await this.create({
        userId: application.userId,
        eventKey: `interview-reminder:${interview.id}:${interview.scheduledAt.toISOString()}`,
        title: "Upcoming interview",
        body: `${application.company} — ${application.role}. Interview at ${time} (${application.user.timeZone}).`,
        href: `/applications/${application.id}`,
      });
    }
    const applications = await this.client.application.findMany({
      where: {
        archivedAt: null,
        nextFollowUpAt: { lte: now },
        status: { notIn: ["REJECTED", "WITHDRAWN"] },
      },
    });
    for (const application of applications)
      await this.create({
        userId: application.userId,
        eventKey: `follow-up:${application.id}:${application.nextFollowUpAt!.toISOString()}`,
        title: "Follow-up due",
        body: `It's time to follow up on ${application.role} at ${application.company}.`,
        href: `/applications/${application.id}`,
      });
  }
  async isRelevant(eventKey: string, now: Date): Promise<boolean> {
    const [kind, id, ...timeParts] = eventKey.split(":");
    if (kind !== "interview-reminder" && kind !== "follow-up") return true;
    const scheduledAt = new Date(timeParts.join(":"));
    if (!id || Number.isNaN(scheduledAt.getTime())) return false;
    if (kind === "interview-reminder") {
      return Boolean(
        await this.client.interview.findFirst({
          where: {
            id,
            status: "SCHEDULED",
            scheduledAt: { equals: scheduledAt, gt: now },
            application: { archivedAt: null },
          },
          select: { id: true },
        }),
      );
    }
    return Boolean(
      await this.client.application.findFirst({
        where: {
          id,
          archivedAt: null,
          nextFollowUpAt: { equals: scheduledAt, lte: now },
          status: { notIn: ["REJECTED", "WITHDRAWN"] },
        },
        select: { id: true },
      }),
    );
  }
  async claim(now: Date) {
    // An atomic lease prevents multiple API replicas sending the same job concurrently.
    return this.client.$transaction(async (tx) => {
      await tx.notification.updateMany({
        where: { emailStatus: "PENDING", nextAttemptAt: { lte: now }, attempts: { gte: 5 } },
        data: { emailStatus: "FAILED" },
      });
      const rows = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT id FROM notifications WHERE email_status = 'PENDING' AND attempts < 5 AND next_attempt_at <= ${now} ORDER BY created_at LIMIT 5 FOR UPDATE SKIP LOCKED`;
      if (!rows.length) return [];
      await tx.notification.updateMany({
        where: { id: { in: rows.map((row) => row.id) } },
        data: { nextAttemptAt: new Date(now.getTime() + 5 * 60_000), attempts: { increment: 1 } },
      });
      return tx.notification.findMany({
        where: { id: { in: rows.map((row) => row.id) } },
        include: {
          user: { select: { email: true, emailVerified: true, notificationsEnabled: true } },
        },
      });
    });
  }
  finish(id: string, emailStatus: string, nextAttemptAt?: Date, providerMessageId?: string) {
    return this.client.notification.update({
      where: { id },
      data: {
        emailStatus,
        ...(nextAttemptAt ? { nextAttemptAt } : {}),
        ...(providerMessageId ? { providerMessageId } : {}),
      },
    });
  }
}
