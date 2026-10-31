import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type {
  CreateInterviewInput,
  InterviewListQuery,
  UpdateInterviewInput,
} from "./interviews.validators.js";

export type InterviewApplicationResult =
  | { kind: "application-not-found" }
  | { kind: "created"; interview: Prisma.InterviewGetPayload<object> };
export type InterviewMutationResult =
  { kind: "not-found" } | { kind: "updated"; interview: Prisma.InterviewGetPayload<object> };
export type InterviewListResult =
  { kind: "application-not-found" } | { kind: "listed"; items: unknown[]; total: number };

export class InterviewRepository {
  constructor(private readonly client: PrismaClient) {}

  async list(
    userId: string,
    query: InterviewListQuery,
    now: Date,
    applicationId?: string,
  ): Promise<InterviewListResult> {
    if (applicationId) {
      const application = await this.client.application.findFirst({
        where: { id: applicationId, userId },
        select: { id: true },
      });
      if (!application) return { kind: "application-not-found" };
    }
    const where: Prisma.InterviewWhereInput = {
      application: { userId, ...(query.includeArchived ? {} : { archivedAt: null }) },
      ...(applicationId ? { applicationId } : {}),
      ...(query.range === "upcoming"
        ? { scheduledAt: { gte: now } }
        : query.range === "past"
          ? { scheduledAt: { lt: now } }
          : {}),
    };
    const [items, total] = await this.client.$transaction([
      this.client.interview.findMany({
        where,
        include: {
          application: { select: { id: true, company: true, role: true, archivedAt: true } },
        },
        orderBy: [{ scheduledAt: query.range === "past" ? "desc" : "asc" }, { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.client.interview.count({ where }),
    ]);
    return { kind: "listed", items, total };
  }

  async create(
    userId: string,
    applicationId: string,
    input: CreateInterviewInput,
  ): Promise<InterviewApplicationResult> {
    return this.client.$transaction(async (transaction) => {
      const application = await transaction.application.findFirst({
        where: { id: applicationId, userId },
        select: { id: true },
      });
      if (!application) return { kind: "application-not-found" };
      const interview = await transaction.interview.create({
        data: {
          applicationId,
          type: input.type,
          scheduledAt: input.scheduledAt,
          ...(input.interviewerName ? { interviewerName: input.interviewerName } : {}),
          ...(input.meetingLink ? { meetingLink: input.meetingLink } : {}),
          ...(input.location ? { location: input.location } : {}),
          ...(input.notes ? { notes: input.notes } : {}),
          ...(input.status ? { status: input.status } : {}),
        },
      });
      await transaction.notification.create({
        data: {
          userId,
          eventKey: `interview:create:${randomUUID()}`,
          title: "Interview scheduled",
          body: `Your interview is ${interview.status.toLowerCase()} for ${interview.scheduledAt.toISOString()}. Open the application for details.`,
          href: `/applications/${interview.applicationId}`,
        },
      });
      return { kind: "created", interview };
    });
  }

  async update(
    userId: string,
    id: string,
    input: UpdateInterviewInput,
  ): Promise<InterviewMutationResult> {
    return this.client.$transaction(async (transaction) => {
      const existing = await transaction.interview.findFirst({
        where: { id, application: { userId } },
        select: { id: true },
      });
      if (!existing) return { kind: "not-found" };
      const interview = await transaction.interview.update({
        where: { id },
        data: {
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.scheduledAt !== undefined ? { scheduledAt: input.scheduledAt } : {}),
          ...(input.interviewerName !== undefined
            ? { interviewerName: input.interviewerName }
            : {}),
          ...(input.meetingLink !== undefined ? { meetingLink: input.meetingLink } : {}),
          ...(input.location !== undefined ? { location: input.location } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
      });
      await transaction.notification.create({
        data: {
          userId,
          eventKey: `interview:update:${randomUUID()}`,
          title: "Interview updated",
          body: `Your interview is ${interview.status.toLowerCase()} for ${interview.scheduledAt.toISOString()}. Open the application for details.`,
          href: `/applications/${interview.applicationId}`,
        },
      });
      return { kind: "updated", interview };
    });
  }

  async delete(userId: string, id: string): Promise<boolean> {
    return this.client.$transaction(async (transaction) => {
      const existing = await transaction.interview.findFirst({
        where: { id, application: { userId } },
        select: { id: true, applicationId: true },
      });
      if (!existing) return false;
      await transaction.interview.delete({ where: { id } });
      await transaction.notification.create({
        data: {
          userId,
          eventKey: `interview-delete:${randomUUID()}`,
          title: "Interview removed",
          body: "An interview was removed from your application.",
          href: `/applications/${existing.applicationId}`,
        },
      });
      return true;
    });
  }
}
