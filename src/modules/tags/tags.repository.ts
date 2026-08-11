import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { AddApplicationTagsInput, CreateTagInput, UpdateTagInput } from "./tags.validators.js";

export type TagCreateResult =
  { kind: "conflict" } | { kind: "created"; tag: Prisma.TagGetPayload<object> };
export type TagUpdateResult =
  | { kind: "not-found" }
  | { kind: "conflict" }
  | { kind: "updated"; tag: Prisma.TagGetPayload<object> };
export type AddTagsResult =
  | { kind: "application-not-found" }
  | { kind: "invalid-tags" }
  | { kind: "added"; tags: Prisma.ApplicationTagGetPayload<{ include: { tag: true } }>[] };
export type RemoveTagResult =
  { kind: "application-not-found" } | { kind: "invalid-tag" } | { kind: "removed" };

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export class TagRepository {
  constructor(private readonly client: PrismaClient) {}

  async list(userId: string) {
    return this.client.tag.findMany({
      where: { userId },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  }

  async create(userId: string, input: CreateTagInput): Promise<TagCreateResult> {
    try {
      const tag = await this.client.tag.create({
        data: { userId, name: input.name, ...(input.color ? { color: input.color } : {}) },
      });
      return { kind: "created", tag };
    } catch (error) {
      if (isUniqueConstraintError(error)) return { kind: "conflict" };
      throw error;
    }
  }

  async update(userId: string, id: string, input: UpdateTagInput): Promise<TagUpdateResult> {
    const existing = await this.client.tag.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) return { kind: "not-found" };
    try {
      const tag = await this.client.tag.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
        },
      });
      return { kind: "updated", tag };
    } catch (error) {
      if (isUniqueConstraintError(error)) return { kind: "conflict" };
      throw error;
    }
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.client.tag.deleteMany({ where: { id, userId } });
    return result.count === 1;
  }

  async addToApplication(
    userId: string,
    applicationId: string,
    input: AddApplicationTagsInput,
  ): Promise<AddTagsResult> {
    return this.client.$transaction(async (transaction) => {
      const application = await transaction.application.findFirst({
        where: { id: applicationId, userId },
        select: { id: true },
      });
      if (!application) return { kind: "application-not-found" };
      const tagCount = await transaction.tag.count({ where: { userId, id: { in: input.tagIds } } });
      if (tagCount !== input.tagIds.length) return { kind: "invalid-tags" };
      await transaction.applicationTag.createMany({
        data: input.tagIds.map((tagId) => ({ applicationId, tagId })),
        skipDuplicates: true,
      });
      const tags = await transaction.applicationTag.findMany({
        where: { applicationId },
        include: { tag: true },
        orderBy: { tag: { name: "asc" } },
      });
      return { kind: "added", tags };
    });
  }

  async removeFromApplication(
    userId: string,
    applicationId: string,
    tagId: string,
  ): Promise<RemoveTagResult> {
    return this.client.$transaction(async (transaction) => {
      const application = await transaction.application.findFirst({
        where: { id: applicationId, userId },
        select: { id: true },
      });
      if (!application) return { kind: "application-not-found" };
      const tag = await transaction.tag.findFirst({
        where: { id: tagId, userId },
        select: { id: true },
      });
      if (!tag) return { kind: "invalid-tag" };
      await transaction.applicationTag.deleteMany({ where: { applicationId, tagId } });
      return { kind: "removed" };
    });
  }
}
