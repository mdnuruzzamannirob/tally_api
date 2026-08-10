import type { PrismaClient } from "../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import type { CreateApplicationInput } from "./application.validators.js";

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
}
