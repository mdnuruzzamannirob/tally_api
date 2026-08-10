import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { ApiError } from "../../lib/api-error.js";
import type {
  CreateApplicationInput,
  ListApplicationsQuery,
  ChangeApplicationStatusInput,
  UpdateApplicationInput,
} from "./application.validators.js";

const applicationInclude = { tags: { include: { tag: true } } } as const;
const statusRank: Record<string, number> = {
  WISHLIST: 0,
  APPLIED: 1,
  SCREENING: 2,
  INTERVIEW: 3,
  OFFER: 4,
  REJECTED: 5,
  WITHDRAWN: 6,
};

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
  const offsetName = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  })
    .formatToParts(noon)
    .find(({ type }) => type === "timeZoneName")?.value;
  const offsetMatch = offsetName?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  const offsetMinutes = offsetMatch
    ? (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3])) * (offsetMatch[1] === "+" ? 1 : -1)
    : 0;
  const start = new Date(Date.parse(`${localDate}T00:00:00.000Z`) - offsetMinutes * 60_000);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60_000) };
}

export class ApplicationService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(userId: string, input: CreateApplicationInput) {
    return this.prisma.$transaction(async (transaction) => {
      const tagIds = input.tagIds ?? [];
      if (tagIds.length) {
        const tagCount = await transaction.tag.count({ where: { userId, id: { in: tagIds } } });
        if (tagCount !== tagIds.length) {
          throw new ApiError(400, "BAD_REQUEST", "One or more tags are invalid.");
        }
      }
      const status = input.status ?? "WISHLIST";
      const application = await transaction.application.create({
        data: {
          userId,
          company: input.company,
          role: input.role,
          ...(input.jobUrl ? { jobUrl: input.jobUrl } : {}),
          ...(input.location ? { location: input.location } : {}),
          ...(input.remoteType ? { remoteType: input.remoteType } : {}),
          ...(input.employmentType ? { employmentType: input.employmentType } : {}),
          ...(input.source ? { source: input.source } : {}),
          status,
          ...(input.appliedAt ? { appliedAt: new Date(`${input.appliedAt}T00:00:00.000Z`) } : {}),
          ...(input.salaryMin !== undefined ? { salaryMin: input.salaryMin } : {}),
          ...(input.salaryMax !== undefined ? { salaryMax: input.salaryMax } : {}),
          ...(input.currency ? { currency: input.currency } : {}),
          ...(input.nextFollowUpAt ? { nextFollowUpAt: input.nextFollowUpAt } : {}),
          ...(tagIds.length ? { tags: { create: tagIds.map((tagId) => ({ tagId })) } } : {}),
          ...(input.initialNote ? { notes: { create: { content: input.initialNote } } } : {}),
          ...(status === "WISHLIST"
            ? {}
            : { statusHistory: { create: { fromStatus: "WISHLIST", toStatus: status } } }),
        },
        include: applicationInclude,
      });
      return application;
    });
  }

  async getById(userId: string, id: string) {
    const application = await this.prisma.application.findFirst({
      where: { id, userId },
      include: applicationInclude,
    });
    if (!application) throw new ApiError(404, "NOT_FOUND", "Application was not found.");
    return application;
  }

  async list(userId: string, query: ListApplicationsQuery) {
    const where: Prisma.ApplicationWhereInput = {
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
              {
                tags: { some: { tag: { name: { contains: query.search, mode: "insensitive" } } } },
              },
              { notes: { some: { content: { contains: query.search, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };
    if (query.followUp) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { timeZone: true },
      });
      const { start, end } = dayBounds(user?.timeZone ?? "UTC");
      Object.assign(where, {
        nextFollowUpAt:
          query.followUp === "overdue"
            ? { lt: start }
            : query.followUp === "today"
              ? { gte: start, lt: end }
              : query.followUp === "upcoming"
                ? { gte: end }
                : null,
      });
    }

    const skip = (query.page - 1) * query.pageSize;
    if (query.sort === "status") {
      const matching = await this.prisma.application.findMany({
        where,
        select: { id: true, status: true },
      });
      matching.sort((left, right) => {
        const comparison = (statusRank[left.status] ?? 0) - (statusRank[right.status] ?? 0);
        const ordered = query.order === "asc" ? comparison : -comparison;
        return ordered || left.id.localeCompare(right.id);
      });
      const ids = matching.slice(skip, skip + query.pageSize).map(({ id }) => id);
      const unsortedItems = await this.prisma.application.findMany({
        where: { id: { in: ids } },
        include: applicationInclude,
      });
      const itemById = new Map(unsortedItems.map((item) => [item.id, item]));
      return {
        items: ids.flatMap((id) => (itemById.has(id) ? [itemById.get(id)!] : [])),
        total: matching.length,
      };
    }
    const orderBy = [
      { [query.sort]: query.order },
      { id: "asc" },
    ] as Prisma.ApplicationOrderByWithRelationInput[];
    const [items, total] = await this.prisma.$transaction([
      this.prisma.application.findMany({
        where,
        include: applicationInclude,
        orderBy,
        skip,
        take: query.pageSize,
      }),
      this.prisma.application.count({ where }),
    ]);
    return { items, total };
  }

  async update(userId: string, id: string, input: UpdateApplicationInput) {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.application.findFirst({ where: { id, userId } });
      if (!existing) throw new ApiError(404, "NOT_FOUND", "Application was not found.");

      if (input.tagIds !== undefined && input.tagIds.length) {
        const tagCount = await transaction.tag.count({
          where: { userId, id: { in: input.tagIds } },
        });
        if (tagCount !== input.tagIds.length) {
          throw new ApiError(400, "BAD_REQUEST", "One or more tags are invalid.");
        }
      }

      const salaryMin = input.salaryMin === undefined ? existing.salaryMin : input.salaryMin;
      const salaryMax = input.salaryMax === undefined ? existing.salaryMax : input.salaryMax;
      const currency = input.currency === undefined ? existing.currency : input.currency;
      if ((salaryMin !== null || salaryMax !== null) && !currency) {
        throw new ApiError(400, "VALIDATION_ERROR", "Currency is required with salary.");
      }
      if (salaryMin !== null && salaryMax !== null && Number(salaryMax) < Number(salaryMin)) {
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          "Salary maximum cannot be below salary minimum.",
        );
      }

      if (input.tagIds !== undefined) {
        await transaction.applicationTag.deleteMany({ where: { applicationId: id } });
        if (input.tagIds.length) {
          await transaction.applicationTag.createMany({
            data: input.tagIds.map((tagId) => ({ applicationId: id, tagId })),
          });
        }
      }

      return transaction.application.update({
        where: { id },
        data: {
          ...(input.company !== undefined ? { company: input.company } : {}),
          ...(input.role !== undefined ? { role: input.role } : {}),
          ...(input.jobUrl !== undefined ? { jobUrl: input.jobUrl } : {}),
          ...(input.location !== undefined ? { location: input.location } : {}),
          ...(input.remoteType !== undefined ? { remoteType: input.remoteType } : {}),
          ...(input.employmentType !== undefined ? { employmentType: input.employmentType } : {}),
          ...(input.source !== undefined ? { source: input.source } : {}),
          ...(input.appliedAt !== undefined
            ? { appliedAt: input.appliedAt ? new Date(`${input.appliedAt}T00:00:00.000Z`) : null }
            : {}),
          ...(input.salaryMin !== undefined ? { salaryMin: input.salaryMin } : {}),
          ...(input.salaryMax !== undefined ? { salaryMax: input.salaryMax } : {}),
          ...(input.currency !== undefined ? { currency: input.currency } : {}),
          ...(input.nextFollowUpAt !== undefined ? { nextFollowUpAt: input.nextFollowUpAt } : {}),
        },
        include: applicationInclude,
      });
    });
  }

  async changeStatus(userId: string, id: string, input: ChangeApplicationStatusInput) {
    return this.prisma.$transaction(async (transaction) => {
      const application = await transaction.application.findFirst({
        where: { id, userId },
        select: { id: true, status: true },
      });
      if (!application) throw new ApiError(404, "NOT_FOUND", "Application was not found.");
      if (application.status === input.toStatus) {
        throw new ApiError(409, "CONFLICT", "Application already has this status.");
      }
      const changed = await transaction.application.updateMany({
        where: { id, userId, status: application.status },
        data: { status: input.toStatus },
      });
      if (changed.count !== 1) {
        throw new ApiError(409, "CONFLICT", "Application status changed; retry the request.");
      }
      await transaction.statusHistory.create({
        data: {
          applicationId: id,
          fromStatus: application.status,
          toStatus: input.toStatus,
          ...(input.note ? { note: input.note } : {}),
        },
      });
      return { id, status: input.toStatus };
    });
  }

  async getHistory(userId: string, id: string) {
    const application = await this.prisma.application.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!application) throw new ApiError(404, "NOT_FOUND", "Application was not found.");
    return this.prisma.statusHistory.findMany({
      where: { applicationId: id },
      orderBy: [{ changedAt: "desc" }, { id: "desc" }],
    });
  }

  async archive(userId: string, id: string): Promise<void> {
    const result = await this.prisma.application.updateMany({
      where: { id, userId },
      data: { archivedAt: new Date() },
    });
    if (result.count !== 1) throw new ApiError(404, "NOT_FOUND", "Application was not found.");
  }

  async unarchive(userId: string, id: string): Promise<void> {
    const result = await this.prisma.application.updateMany({
      where: { id, userId },
      data: { archivedAt: null },
    });
    if (result.count !== 1) throw new ApiError(404, "NOT_FOUND", "Application was not found.");
  }

  async delete(userId: string, id: string): Promise<void> {
    const result = await this.prisma.application.deleteMany({ where: { id, userId } });
    if (result.count !== 1) throw new ApiError(404, "NOT_FOUND", "Application was not found.");
  }
}
