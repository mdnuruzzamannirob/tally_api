import type { PrismaClient } from "../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import type { CreateApplicationInput, UpdateApplicationInput } from "./application.validators.js";

const applicationInclude = { tags: { include: { tag: true } } } as const;

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
