import { ApiError } from "../../lib/api-error.js";
import type { TagRepository } from "./tag.repository.js";
import type { AddApplicationTagsInput, CreateTagInput, UpdateTagInput } from "./tag.validators.js";

export class TagService {
  constructor(private readonly repository: TagRepository) {}

  async list(userId: string) {
    return this.repository.list(userId);
  }

  async create(userId: string, input: CreateTagInput) {
    const result = await this.repository.create(userId, input);
    if (result.kind === "conflict")
      throw new ApiError(409, "CONFLICT", "A tag with this name already exists.");
    return result.tag;
  }

  async update(userId: string, id: string, input: UpdateTagInput) {
    const result = await this.repository.update(userId, id, input);
    if (result.kind === "not-found") throw new ApiError(404, "NOT_FOUND", "Tag was not found.");
    if (result.kind === "conflict")
      throw new ApiError(409, "CONFLICT", "A tag with this name already exists.");
    return result.tag;
  }

  async delete(userId: string, id: string): Promise<void> {
    if (!(await this.repository.delete(userId, id)))
      throw new ApiError(404, "NOT_FOUND", "Tag was not found.");
  }

  async addToApplication(userId: string, applicationId: string, input: AddApplicationTagsInput) {
    const result = await this.repository.addToApplication(userId, applicationId, input);
    if (result.kind === "application-not-found")
      throw new ApiError(404, "NOT_FOUND", "Application was not found.");
    if (result.kind === "invalid-tags")
      throw new ApiError(400, "BAD_REQUEST", "One or more tags are invalid.");
    return result.tags;
  }

  async removeFromApplication(userId: string, applicationId: string, tagId: string): Promise<void> {
    const result = await this.repository.removeFromApplication(userId, applicationId, tagId);
    if (result.kind === "application-not-found")
      throw new ApiError(404, "NOT_FOUND", "Application was not found.");
    if (result.kind === "invalid-tag") throw new ApiError(400, "BAD_REQUEST", "Tag is invalid.");
  }
}
