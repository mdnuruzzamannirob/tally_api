import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import type {
  CreateInterviewInput,
  InterviewListQuery,
  UpdateInterviewInput,
} from "./interview.validators.js";

export class InterviewService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(userId: string, query: InterviewListQuery, applicationId?: string) {
    if (applicationId) await this.requireApplication(userId, applicationId);
    const now = new Date();
    const where: Prisma.InterviewWhereInput = {
      application: {
        userId,
        ...(query.includeArchived ? {} : { archivedAt: null }),
      },
      ...(applicationId ? { applicationId } : {}),
      scheduledAt: query.range === "upcoming" ? { gte: now } : { lt: now },
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.interview.findMany({
        where,
        include: {
          application: { select: { id: true, company: true, role: true, archivedAt: true } },
        },
        orderBy: [{ scheduledAt: query.range === "upcoming" ? "asc" : "desc" }, { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.interview.count({ where }),
    ]);
    return { items, total };
  }

  async create(userId: string, applicationId: string, input: CreateInterviewInput) {
    await this.requireApplication(userId, applicationId);
    return this.prisma.interview.create({
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
  }

  async update(userId: string, id: string, input: UpdateInterviewInput) {
    const interview = await this.prisma.interview.findFirst({
      where: { id, application: { userId } },
      select: { id: true },
    });
    if (!interview) throw new ApiError(404, "NOT_FOUND", "Interview was not found.");
    return this.prisma.interview.update({
      where: { id },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.scheduledAt !== undefined ? { scheduledAt: input.scheduledAt } : {}),
        ...(input.interviewerName !== undefined ? { interviewerName: input.interviewerName } : {}),
        ...(input.meetingLink !== undefined ? { meetingLink: input.meetingLink } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });
  }

  async delete(userId: string, id: string): Promise<void> {
    const interview = await this.prisma.interview.findFirst({
      where: { id, application: { userId } },
      select: { id: true },
    });
    if (!interview) throw new ApiError(404, "NOT_FOUND", "Interview was not found.");
    await this.prisma.interview.delete({ where: { id } });
  }

  private async requireApplication(userId: string, applicationId: string): Promise<void> {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, userId },
      select: { id: true },
    });
    if (!application) throw new ApiError(404, "NOT_FOUND", "Application was not found.");
  }
}
