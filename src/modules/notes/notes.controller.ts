import type { Request, Response } from "express";

import { ApiError } from "../../core/errors/api-error.js";
import { sendSuccess } from "../../http/response/success-response.js";
import type { NoteService } from "./notes.service.js";
import { createNoteSchema, updateNoteSchema } from "./notes.validators.js";

function userIdOrThrow(request: Request): string {
  if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
  return request.auth.userId;
}

function paramOrThrow(request: Request, name: "id", label: string): string {
  const value = request.params[name];
  if (typeof value !== "string" || !value)
    throw new ApiError(400, "BAD_REQUEST", `${label} is required.`);
  return value;
}

export class NoteController {
  constructor(private readonly service: NoteService) {}

  async list(request: Request, response: Response): Promise<void> {
    sendSuccess(response, {
      notes: await this.service.list(
        userIdOrThrow(request),
        paramOrThrow(request, "id", "Application ID"),
      ),
    });
  }

  async create(request: Request, response: Response): Promise<void> {
    const note = await this.service.create(
      userIdOrThrow(request),
      paramOrThrow(request, "id", "Application ID"),
      createNoteSchema.parse(request.body),
    );
    sendSuccess(response, { note }, 201);
  }

  async update(request: Request, response: Response): Promise<void> {
    const note = await this.service.update(
      userIdOrThrow(request),
      paramOrThrow(request, "id", "Note ID"),
      updateNoteSchema.parse(request.body),
    );
    sendSuccess(response, { note });
  }

  async delete(request: Request, response: Response): Promise<void> {
    await this.service.delete(userIdOrThrow(request), paramOrThrow(request, "id", "Note ID"));
    sendSuccess(response, {}, { message: "Note deleted" });
  }
}
