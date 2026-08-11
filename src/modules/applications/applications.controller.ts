import type { Request, Response } from "express";

import { ApiError } from "../../core/errors/api-error.js";
import { sendSuccess } from "../../http/response/success-response.js";
import type { ApplicationService } from "./applications.service.js";
import {
  changeApplicationStatusSchema,
  createApplicationSchema,
  listApplicationsQuerySchema,
  updateApplicationSchema,
} from "./applications.validators.js";

function userIdOrThrow(request: Request): string {
  if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
  return request.auth.userId;
}

function applicationIdOrThrow(request: Request): string {
  if (typeof request.params.id !== "string" || !request.params.id) {
    throw new ApiError(400, "BAD_REQUEST", "Application ID is required.");
  }
  return request.params.id;
}

export class ApplicationController {
  constructor(private readonly service: ApplicationService) {}

  async list(request: Request, response: Response): Promise<void> {
    const query = listApplicationsQuerySchema.parse(request.query);
    const result = await this.service.list(userIdOrThrow(request), query);
    const meta = {
      page: query.page,
      limit: query.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / query.pageSize),
    };
    sendSuccess(
      response,
      { items: result.items, pagination: { ...meta, pageSize: query.pageSize } },
      { message: "Applications retrieved successfully.", meta },
    );
  }

  async create(request: Request, response: Response): Promise<void> {
    const application = await this.service.create(
      userIdOrThrow(request),
      createApplicationSchema.parse(request.body),
    );
    sendSuccess(response, { application }, 201);
  }

  async getById(request: Request, response: Response): Promise<void> {
    sendSuccess(response, {
      application: await this.service.getById(
        userIdOrThrow(request),
        applicationIdOrThrow(request),
      ),
    });
  }

  async update(request: Request, response: Response): Promise<void> {
    const application = await this.service.update(
      userIdOrThrow(request),
      applicationIdOrThrow(request),
      updateApplicationSchema.parse(request.body),
    );
    sendSuccess(response, { application });
  }

  async changeStatus(request: Request, response: Response): Promise<void> {
    const application = await this.service.changeStatus(
      userIdOrThrow(request),
      applicationIdOrThrow(request),
      changeApplicationStatusSchema.parse(request.body),
    );
    sendSuccess(response, { application });
  }

  async history(request: Request, response: Response): Promise<void> {
    sendSuccess(response, {
      history: await this.service.getHistory(userIdOrThrow(request), applicationIdOrThrow(request)),
    });
  }

  async archive(request: Request, response: Response): Promise<void> {
    await this.service.archive(userIdOrThrow(request), applicationIdOrThrow(request));
    sendSuccess(response, {}, { message: "Application archived" });
  }

  async unarchive(request: Request, response: Response): Promise<void> {
    await this.service.unarchive(userIdOrThrow(request), applicationIdOrThrow(request));
    sendSuccess(response, {}, { message: "Application unarchived" });
  }

  async delete(request: Request, response: Response): Promise<void> {
    await this.service.delete(userIdOrThrow(request), applicationIdOrThrow(request));
    sendSuccess(response, {}, { message: "Application deleted" });
  }
}
