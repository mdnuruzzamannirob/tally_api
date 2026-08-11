import type { Request, Response } from "express";

import { ApiError } from "../../core/errors/api-error.js";
import { sendSuccess } from "../../http/response/success-response.js";
import type { TagService } from "./tags.service.js";
import { addApplicationTagsSchema, createTagSchema, updateTagSchema } from "./tags.validators.js";

function userIdOrThrow(request: Request): string {
  if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
  return request.auth.userId;
}

function paramOrThrow(request: Request, name: "id" | "tagId", label: string): string {
  const value = request.params[name];
  if (typeof value !== "string" || !value)
    throw new ApiError(400, "BAD_REQUEST", `${label} is required.`);
  return value;
}

export class TagController {
  constructor(private readonly service: TagService) {}

  async list(request: Request, response: Response): Promise<void> {
    sendSuccess(response, { tags: await this.service.list(userIdOrThrow(request)) });
  }

  async create(request: Request, response: Response): Promise<void> {
    const tag = await this.service.create(
      userIdOrThrow(request),
      createTagSchema.parse(request.body),
    );
    sendSuccess(response, { tag }, 201);
  }

  async update(request: Request, response: Response): Promise<void> {
    const tag = await this.service.update(
      userIdOrThrow(request),
      paramOrThrow(request, "id", "Tag ID"),
      updateTagSchema.parse(request.body),
    );
    sendSuccess(response, { tag });
  }

  async delete(request: Request, response: Response): Promise<void> {
    await this.service.delete(userIdOrThrow(request), paramOrThrow(request, "id", "Tag ID"));
    sendSuccess(response, {}, { message: "Tag deleted" });
  }

  async addToApplication(request: Request, response: Response): Promise<void> {
    const tags = await this.service.addToApplication(
      userIdOrThrow(request),
      paramOrThrow(request, "id", "Application ID"),
      addApplicationTagsSchema.parse(request.body),
    );
    sendSuccess(response, { tags });
  }

  async removeFromApplication(request: Request, response: Response): Promise<void> {
    await this.service.removeFromApplication(
      userIdOrThrow(request),
      paramOrThrow(request, "id", "Application ID"),
      paramOrThrow(request, "tagId", "Tag ID"),
    );
    sendSuccess(response, {}, { message: "Tag removed from application" });
  }
}
