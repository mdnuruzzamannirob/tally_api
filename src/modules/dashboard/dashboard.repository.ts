import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

const listLimit = 5;
const applicationProjection = {
  id: true,
  company: true,
  role: true,
  status: true,
  nextFollowUpAt: true,
} as const;

export class DashboardRepository {
  constructor(private readonly client: PrismaClient) {}

  async getTimeZone(userId: string): Promise<string | null> {
    const user = await this.client.user.findUnique({
      where: { id: userId },
      select: { timeZone: true },
    });
    return user?.timeZone ?? null;
  }

  async getSummary(userId: string, bounds: { start: Date; end: Date }, now: Date) {
    const applicationWhere: Prisma.ApplicationWhereInput = { userId, archivedAt: null };
    const activeWhere: Prisma.ApplicationWhereInput = {
      ...applicationWhere,
      status: { in: ["APPLIED", "SCREENING", "INTERVIEW"] },
    };
    const interviewWhere = {
      status: "SCHEDULED" as const,
      scheduledAt: { gte: now },
      application: applicationWhere,
    };
    const overdueWhere = { ...applicationWhere, nextFollowUpAt: { lt: bounds.start } };
    const todayWhere = {
      ...applicationWhere,
      nextFollowUpAt: { gte: bounds.start, lt: bounds.end },
    };
    const [
      totalApplications,
      activeApplications,
      offers,
      scheduledInterviews,
      statusGroups,
      overdueCount,
      todayCount,
      overdue,
      today,
      upcomingInterviews,
      recentApplications,
    ] = await this.client.$transaction([
      this.client.application.count({ where: applicationWhere }),
      this.client.application.count({ where: activeWhere }),
      this.client.application.count({ where: { ...applicationWhere, status: "OFFER" } }),
      this.client.interview.count({ where: interviewWhere }),
      this.client.application.groupBy({
        where: applicationWhere,
        by: ["status"],
        orderBy: { status: "asc" },
        _count: { _all: true },
      }),
      this.client.application.count({ where: overdueWhere }),
      this.client.application.count({ where: todayWhere }),
      this.client.application.findMany({
        where: overdueWhere,
        select: applicationProjection,
        orderBy: [{ nextFollowUpAt: "asc" }, { id: "asc" }],
        take: listLimit,
      }),
      this.client.application.findMany({
        where: todayWhere,
        select: applicationProjection,
        orderBy: [{ nextFollowUpAt: "asc" }, { id: "asc" }],
        take: listLimit,
      }),
      this.client.interview.findMany({
        where: interviewWhere,
        select: {
          id: true,
          type: true,
          status: true,
          scheduledAt: true,
          application: { select: { id: true, company: true, role: true } },
        },
        orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
        take: listLimit,
      }),
      this.client.application.findMany({
        where: applicationWhere,
        select: { id: true, company: true, role: true, status: true, updatedAt: true },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: listLimit,
      }),
    ]);
    return {
      totalApplications,
      activeApplications,
      offers,
      scheduledInterviews,
      statusGroups,
      overdueCount,
      todayCount,
      overdue,
      today,
      upcomingInterviews,
      recentApplications,
    };
  }
}
