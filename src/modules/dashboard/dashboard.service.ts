import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

const DASHBOARD_LIST_LIMIT = 5;
const statuses = [
  "WISHLIST",
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
] as const;

function dayBounds(timeZone: string): { start: Date; end: Date } {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts();
  const values = Object.fromEntries(
    dateParts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]),
  );
  const localDate = `${values.year}-${values.month}-${values.day}`;
  const noon = new Date(`${localDate}T12:00:00.000Z`);
  const offsetName = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(noon)
    .find(({ type }) => type === "timeZoneName")?.value;
  const offsetMatch = offsetName?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  const offsetMinutes = offsetMatch
    ? (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3])) * (offsetMatch[1] === "+" ? 1 : -1)
    : 0;
  const start = new Date(Date.parse(`${localDate}T00:00:00.000Z`) - offsetMinutes * 60_000);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60_000) };
}

export class DashboardService {
  constructor(private readonly prisma: PrismaClient) {}

  async getSummary(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timeZone: true },
    });
    const { start, end } = dayBounds(user?.timeZone ?? "UTC");
    const now = new Date();
    const activeWhere: Prisma.ApplicationWhereInput = {
      userId,
      archivedAt: null,
      status: { in: ["APPLIED", "SCREENING", "INTERVIEW"] },
    };
    const applicationWhere: Prisma.ApplicationWhereInput = { userId, archivedAt: null };
    const interviewWhere = {
      status: "SCHEDULED" as const,
      scheduledAt: { gte: now },
      application: applicationWhere,
    };
    const overdueWhere = { ...applicationWhere, nextFollowUpAt: { lt: start } };
    const todayWhere = { ...applicationWhere, nextFollowUpAt: { gte: start, lt: end } };
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
    ] = await this.prisma.$transaction([
      this.prisma.application.count({ where: applicationWhere }),
      this.prisma.application.count({ where: activeWhere }),
      this.prisma.application.count({ where: { ...applicationWhere, status: "OFFER" } }),
      this.prisma.interview.count({ where: interviewWhere }),
      this.prisma.application.groupBy({
        where: applicationWhere,
        by: ["status"],
        orderBy: { status: "asc" },
        _count: { _all: true },
      }),
      this.prisma.application.count({ where: overdueWhere }),
      this.prisma.application.count({ where: todayWhere }),
      this.prisma.application.findMany({
        where: overdueWhere,
        select: { id: true, company: true, role: true, status: true, nextFollowUpAt: true },
        orderBy: [{ nextFollowUpAt: "asc" }, { id: "asc" }],
        take: DASHBOARD_LIST_LIMIT,
      }),
      this.prisma.application.findMany({
        where: todayWhere,
        select: { id: true, company: true, role: true, status: true, nextFollowUpAt: true },
        orderBy: [{ nextFollowUpAt: "asc" }, { id: "asc" }],
        take: DASHBOARD_LIST_LIMIT,
      }),
      this.prisma.interview.findMany({
        where: interviewWhere,
        select: {
          id: true,
          type: true,
          status: true,
          scheduledAt: true,
          application: { select: { id: true, company: true, role: true } },
        },
        orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
        take: DASHBOARD_LIST_LIMIT,
      }),
      this.prisma.application.findMany({
        where: applicationWhere,
        select: { id: true, company: true, role: true, status: true, updatedAt: true },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: DASHBOARD_LIST_LIMIT,
      }),
    ]);
    const statusCounts = Object.fromEntries(statuses.map((status) => [status, 0])) as Record<
      string,
      number
    >;
    for (const group of statusGroups) {
      statusCounts[group.status] = (group._count as { _all: number })._all;
    }
    return {
      totalApplications,
      activeApplications,
      scheduledInterviews,
      offers,
      followUps: { overdueCount, todayCount, overdue, today },
      statusCounts,
      upcomingInterviews,
      recentApplications,
    };
  }
}
