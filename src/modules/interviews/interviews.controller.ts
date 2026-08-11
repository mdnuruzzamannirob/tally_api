import type { Request, Response } from "express";

import { ApiError } from "../../core/errors/api-error.js";
import { sendSuccess } from "../../http/response/success-response.js";
import type { InterviewService } from "./interviews.service.js";
import {
  createInterviewSchema,
  interviewListQuerySchema,
  updateInterviewSchema,
} from "./interviews.validators.js";

function userIdOrThrow(request: Request): string {
  if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
  return request.auth.userId;
}

function paramOrThrow(request: Request, label: string): string {
  const value = request.params.id;
  if (typeof value !== "string" || !value)
    throw new ApiError(400, "BAD_REQUEST", `${label} is required.`);
  return value;
}

function pagination(result: { total: number }, query: { page: number; pageSize: number }) {
  return {
    page: query.page,
    pageSize: query.pageSize,
    total: result.total,
    totalPages: Math.ceil(result.total / query.pageSize),
  };
}

export class InterviewController {
  constructor(private readonly service: InterviewService) {}

  async listApplication(request: Request, response: Response): Promise<void> {
    const query = interviewListQuerySchema.parse(request.query);
    const result = await this.service.list(
      userIdOrThrow(request),
      query,
      paramOrThrow(request, "Application ID"),
    );
    const meta = pagination(result, query);
    sendSuccess(
      response,
      { items: result.items, pagination: meta },
      {
        message: "Interviews retrieved successfully.",
        meta: {
          page: meta.page,
          limit: meta.pageSize,
          total: meta.total,
          totalPages: meta.totalPages,
        },
      },
    );
  }

  async create(request: Request, response: Response): Promise<void> {
    const interview = await this.service.create(
      userIdOrThrow(request),
      paramOrThrow(request, "Application ID"),
      createInterviewSchema.parse(request.body),
    );
    sendSuccess(response, { interview }, 201);
  }

  async list(request: Request, response: Response): Promise<void> {
    const query = interviewListQuerySchema.parse(request.query);
    const result = await this.service.list(userIdOrThrow(request), query);
    const meta = pagination(result, query);
    sendSuccess(
      response,
      { items: result.items, pagination: meta },
      {
        message: "Application interviews retrieved successfully.",
        meta: {
          page: meta.page,
          limit: meta.pageSize,
          total: meta.total,
          totalPages: meta.totalPages,
        },
      },
    );
  }

  async update(request: Request, response: Response): Promise<void> {
    const interview = await this.service.update(
      userIdOrThrow(request),
      paramOrThrow(request, "Interview ID"),
      updateInterviewSchema.parse(request.body),
    );
    sendSuccess(response, { interview });
  }

  async delete(request: Request, response: Response): Promise<void> {
    await this.service.delete(userIdOrThrow(request), paramOrThrow(request, "Interview ID"));
    sendSuccess(response, {}, { message: "Interview deleted" });
  }
}
