import type { Prisma } from "../../generated/prisma/client.js";
import type { ListApplicationsQuery } from "./applications.validators.js";

const statusRank: Record<string, number> = {
  WISHLIST: 0,
  APPLIED: 1,
  SCREENING: 2,
  INTERVIEW: 3,
  OFFER: 4,
  REJECTED: 5,
  WITHDRAWN: 6,
};

export function buildApplicationsWhere(
  userId: string,
  query: ListApplicationsQuery,
  followUpBounds?: { start: Date; end: Date },
): Prisma.ApplicationWhereInput {
  return {
    userId,
    ...(query.includeArchived ? {} : { archivedAt: null }),
    ...(query.status ? { status: query.status } : {}),
    ...(query.remoteType ? { remoteType: query.remoteType } : {}),
    ...(query.employmentType ? { employmentType: query.employmentType } : {}),
    ...(query.source ? { source: { equals: query.source, mode: "insensitive" } } : {}),
    ...(query.tag ? { tags: { some: { tagId: query.tag } } } : {}),
    ...(query.appliedFrom || query.appliedTo
      ? {
          appliedAt: {
            ...(query.appliedFrom ? { gte: new Date(`${query.appliedFrom}T00:00:00.000Z`) } : {}),
            ...(query.appliedTo ? { lte: new Date(`${query.appliedTo}T00:00:00.000Z`) } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { company: { contains: query.search, mode: "insensitive" } },
            { role: { contains: query.search, mode: "insensitive" } },
            { location: { contains: query.search, mode: "insensitive" } },
            { tags: { some: { tag: { name: { contains: query.search, mode: "insensitive" } } } } },
            { notes: { some: { content: { contains: query.search, mode: "insensitive" } } } },
          ],
        }
      : {}),
    ...(query.followUp && followUpBounds
      ? {
          nextFollowUpAt:
            query.followUp === "overdue"
              ? { lt: followUpBounds.start }
              : query.followUp === "today"
                ? { gte: followUpBounds.start, lt: followUpBounds.end }
                : query.followUp === "upcoming"
                  ? { gte: followUpBounds.end }
                  : null,
        }
      : {}),
  };
}

export function sortStatusRows<T extends { id: string; status: string }>(
  rows: T[],
  order: "asc" | "desc",
): T[] {
  return rows.sort((left, right) => {
    const comparison = (statusRank[left.status] ?? 0) - (statusRank[right.status] ?? 0);
    const ordered = order === "asc" ? comparison : -comparison;
    return ordered || left.id.localeCompare(right.id);
  });
}
