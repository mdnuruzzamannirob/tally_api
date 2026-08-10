import type { DashboardRepository } from "./dashboard.repository.js";

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
  constructor(private readonly repository: DashboardRepository) {}

  async getSummary(userId: string) {
    const timeZone = (await this.repository.getTimeZone(userId)) ?? "UTC";
    const result = await this.repository.getSummary(userId, dayBounds(timeZone), new Date());
    const statusCounts = Object.fromEntries(statuses.map((status) => [status, 0])) as Record<
      string,
      number
    >;
    for (const group of result.statusGroups) {
      statusCounts[group.status] = (group._count as { _all: number })._all;
    }
    const {
      statusGroups: _statusGroups,
      overdueCount,
      todayCount,
      overdue,
      today,
      ...summary
    } = result;
    void _statusGroups;
    return { ...summary, followUps: { overdueCount, todayCount, overdue, today }, statusCounts };
  }
}
