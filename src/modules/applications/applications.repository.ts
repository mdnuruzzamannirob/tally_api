import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type {
  ChangeApplicationStatusInput,
  CreateApplicationInput,
  ListApplicationsQuery,
  UpdateApplicationInput,
} from "./applications.validators.js";
import { buildApplicationsWhere, sortStatusRows } from "./applications.query.js";

const applicationInclude = { tags: { include: { tag: true } } } as const;

export interface ApplicationListResult {
  items: Awaited<ReturnType<ApplicationRepository["findMany"]>>;
  total: number;
}

export type CreateApplicationResult =
  | { kind: "invalid-tags" }
  | { kind: "created"; application: Awaited<ReturnType<ApplicationRepository["findOne"]>> };

export type UpdateApplicationResult =
  | { kind: "not-found" }
  | { kind: "invalid-tags" }
  | { kind: "updated"; application: Awaited<ReturnType<ApplicationRepository["findOne"]>> };

export type ChangeStatusResult =
  | { kind: "not-found" }
  | { kind: "already-current" }
  | { kind: "conflict" }
  | { kind: "changed"; id: string; status: ChangeApplicationStatusInput["toStatus"] };

export class ApplicationRepository {
  constructor(private readonly client: PrismaClient) {}

  private async findOne(
    client: PrismaClient | Prisma.TransactionClient,
    userId: string,
    id: string,
  ) {
    return client.application.findFirst({
      where: { id, userId },
      include: applicationInclude,
    });
  }

  private async findMany(
    client: PrismaClient | Prisma.TransactionClient,
    args: Prisma.ApplicationFindManyArgs,
  ) {
    return client.application.findMany(args);
  }

  async create(userId: string, input: CreateApplicationInput): Promise<CreateApplicationResult> {
    return this.client.$transaction(async (transaction) => {
      const tagIds = input.tagIds ?? [];
      if (tagIds.length) {
        const tagCount = await transaction.tag.count({ where: { userId, id: { in: tagIds } } });
        if (tagCount !== tagIds.length) return { kind: "invalid-tags" };
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
      return { kind: "created", application };
    });
  }

  async getById(userId: string, id: string) {
    return this.findOne(this.client, userId, id);
  }

  async getUserTimeZone(userId: string): Promise<string | null> {
    const user = await this.client.user.findUnique({
      where: { id: userId },
      select: { timeZone: true },
    });
    return user?.timeZone ?? null;
  }

  async list(
    userId: string,
    query: ListApplicationsQuery,
    followUpBounds?: { start: Date; end: Date },
  ): Promise<ApplicationListResult> {
    const where = buildApplicationsWhere(userId, query, followUpBounds);

    const skip = (query.page - 1) * query.pageSize;
    if (query.sort === "status") {
      const matching = await this.client.application.findMany({
        where,
        select: { id: true, status: true },
      });
      sortStatusRows(matching, query.order);
      const ids = matching.slice(skip, skip + query.pageSize).map(({ id }) => id);
      const unsortedItems = await this.client.application.findMany({
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
    const [items, total] = await this.client.$transaction([
      this.client.application.findMany({
        where,
        include: applicationInclude,
        orderBy,
        skip,
        take: query.pageSize,
      }),
      this.client.application.count({ where }),
    ]);
    return { items, total };
  }

  async update(
    userId: string,
    id: string,
    input: UpdateApplicationInput,
  ): Promise<UpdateApplicationResult> {
    return this.client.$transaction(async (transaction) => {
      const existing = await transaction.application.findFirst({ where: { id, userId } });
      if (!existing) return { kind: "not-found" };

      if (input.tagIds !== undefined && input.tagIds.length) {
        const tagCount = await transaction.tag.count({
          where: { userId, id: { in: input.tagIds } },
        });
        if (tagCount !== input.tagIds.length) return { kind: "invalid-tags" };
      }
      if (input.tagIds !== undefined) {
        await transaction.applicationTag.deleteMany({ where: { applicationId: id } });
        if (input.tagIds.length) {
          await transaction.applicationTag.createMany({
            data: input.tagIds.map((tagId) => ({ applicationId: id, tagId })),
          });
        }
      }

      const application = await transaction.application.update({
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
      return { kind: "updated", application };
    });
  }

  async getSalaryState(userId: string, id: string) {
    return this.client.application.findFirst({
      where: { id, userId },
      select: { salaryMin: true, salaryMax: true, currency: true },
    });
  }

  async changeStatus(
    userId: string,
    id: string,
    input: ChangeApplicationStatusInput,
  ): Promise<ChangeStatusResult> {
    return this.client.$transaction(async (transaction) => {
      const application = await transaction.application.findFirst({
        where: { id, userId },
        select: { id: true, status: true },
      });
      if (!application) return { kind: "not-found" };
      if (application.status === input.toStatus) return { kind: "already-current" };
      const changed = await transaction.application.updateMany({
        where: { id, userId, status: application.status },
        data: { status: input.toStatus },
      });
      if (changed.count !== 1) return { kind: "conflict" };
      await transaction.statusHistory.create({
        data: {
          applicationId: id,
          fromStatus: application.status,
          toStatus: input.toStatus,
          ...(input.note ? { note: input.note } : {}),
        },
      });
      return { kind: "changed", id, status: input.toStatus };
    });
  }

  async getHistory(userId: string, id: string) {
    const application = await this.client.application.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!application) return null;
    return this.client.statusHistory.findMany({
      where: { applicationId: id },
      orderBy: [{ changedAt: "desc" }, { id: "desc" }],
    });
  }

  async archive(userId: string, id: string, archivedAt: Date | null): Promise<boolean> {
    const result = await this.client.application.updateMany({
      where: { id, userId },
      data: { archivedAt },
    });
    return result.count === 1;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.client.application.deleteMany({ where: { id, userId } });
    return result.count === 1;
  }
}
