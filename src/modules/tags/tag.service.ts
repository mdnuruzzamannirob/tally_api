import type { PrismaClient } from "../../generated/prisma/client.js";
import { ApiError } from "../../lib/api-error.js";
import type { AddApplicationTagsInput, CreateTagInput, UpdateTagInput } from "./tag.validators.js";

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export class TagService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(userId: string) {
    return this.prisma.tag.findMany({
      where: { userId },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  }

  async create(userId: string, input: CreateTagInput) {
    try {
      return await this.prisma.tag.create({
        data: { userId, name: input.name, ...(input.color ? { color: input.color } : {}) },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ApiError(409, "CONFLICT", "A tag with this name already exists.");
      }
      throw error;
    }
  }

  async update(userId: string, id: string, input: UpdateTagInput) {
    const existing = await this.prisma.tag.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Tag was not found.");
    try {
      return await this.prisma.tag.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ApiError(409, "CONFLICT", "A tag with this name already exists.");
      }
      throw error;
    }
  }

  async delete(userId: string, id: string): Promise<void> {
    const result = await this.prisma.tag.deleteMany({ where: { id, userId } });
    if (result.count !== 1) throw new ApiError(404, "NOT_FOUND", "Tag was not found.");
  }

  async addToApplication(userId: string, applicationId: string, input: AddApplicationTagsInput) {
    return this.prisma.$transaction(async (transaction) => {
      const application = await transaction.application.findFirst({
        where: { id: applicationId, userId },
        select: { id: true },
      });
      if (!application) throw new ApiError(404, "NOT_FOUND", "Application was not found.");
      const tagCount = await transaction.tag.count({ where: { userId, id: { in: input.tagIds } } });
      if (tagCount !== input.tagIds.length) {
        throw new ApiError(400, "BAD_REQUEST", "One or more tags are invalid.");
      }
      await transaction.applicationTag.createMany({
        data: input.tagIds.map((tagId) => ({ applicationId, tagId })),
        skipDuplicates: true,
      });
      return transaction.applicationTag.findMany({
        where: { applicationId },
        include: { tag: true },
        orderBy: { tag: { name: "asc" } },
      });
    });
  }

  async removeFromApplication(userId: string, applicationId: string, tagId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const application = await transaction.application.findFirst({
        where: { id: applicationId, userId },
        select: { id: true },
      });
      if (!application) throw new ApiError(404, "NOT_FOUND", "Application was not found.");
      const tag = await transaction.tag.findFirst({
        where: { id: tagId, userId },
        select: { id: true },
      });
      if (!tag) throw new ApiError(400, "BAD_REQUEST", "Tag is invalid.");
      await transaction.applicationTag.deleteMany({ where: { applicationId, tagId } });
    });
  }
}
