import { Router, type Request } from "express";

import { authenticate } from "../../middleware/auth.middleware.js";
import { ApiError } from "../../lib/api-error.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { sendSuccess } from "../../lib/api-response.js";
import type { InterviewService } from "./interview.service.js";
import {
  createInterviewSchema,
  interviewListQuerySchema,
  updateInterviewSchema,
} from "./interview.validators.js";

function userIdOrThrow(request: Request): string {
  if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
  return request.auth.userId;
}

function applicationIdOrThrow(request: Request): string {
  if (typeof request.params.id !== "string" || !request.params.id)
    throw new ApiError(400, "BAD_REQUEST", "Application ID is required.");
  return request.params.id;
}

function pagination(result: { total: number }, query: { page: number; pageSize: number }) {
  return {
    page: query.page,
    pageSize: query.pageSize,
    total: result.total,
    totalPages: Math.ceil(result.total / query.pageSize),
  };
}

export function createApplicationInterviewsRouter(interviewService: InterviewService): Router {
  const router = Router();
  router.get(
    "/:id/interviews",
    authenticate,
    asyncHandler(async (request, response) => {
      const query = interviewListQuerySchema.parse(request.query);
      const result = await interviewService.list(
        userIdOrThrow(request),
        query,
        applicationIdOrThrow(request),
      );
      const meta = pagination(result, query);
      return sendSuccess(response, { items: result.items, pagination: meta }, {
        message: "Interviews retrieved successfully.",
        meta: {
          page: meta.page,
          limit: meta.pageSize,
          total: meta.total,
          totalPages: meta.totalPages,
        },
      });
    }),
  );
  router.post(
    "/:id/interviews",
    authenticate,
    asyncHandler(async (request, response) => {
      const interview = await interviewService.create(
        userIdOrThrow(request),
        applicationIdOrThrow(request),
        createInterviewSchema.parse(request.body),
      );
      return sendSuccess(response, { interview }, 201);
    }),
  );
  return router;
}

export function createInterviewsRouter(interviewService: InterviewService): Router {
  const router = Router();
  router.get(
    "/interviews",
    authenticate,
    asyncHandler(async (request, response) => {
      const query = interviewListQuerySchema.parse(request.query);
      const result = await interviewService.list(userIdOrThrow(request), query);
      const meta = pagination(result, query);
      return sendSuccess(response, { items: result.items, pagination: meta }, {
        message: "Application interviews retrieved successfully.",
        meta: {
          page: meta.page,
          limit: meta.pageSize,
          total: meta.total,
          totalPages: meta.totalPages,
        },
      });
    }),
  );
  router.patch(
    "/interviews/:id",
    authenticate,
    asyncHandler(async (request, response) => {
      if (typeof request.params.id !== "string" || !request.params.id)
        throw new ApiError(400, "BAD_REQUEST", "Interview ID is required.");
      const interview = await interviewService.update(
        userIdOrThrow(request),
        request.params.id,
        updateInterviewSchema.parse(request.body),
      );
      return sendSuccess(response, { interview });
    }),
  );
  router.delete(
    "/interviews/:id",
    authenticate,
    asyncHandler(async (request, response) => {
      if (typeof request.params.id !== "string" || !request.params.id)
        throw new ApiError(400, "BAD_REQUEST", "Interview ID is required.");
      await interviewService.delete(userIdOrThrow(request), request.params.id);
      return sendSuccess(response, { message: "Interview deleted" });
    }),
  );
  return router;
}
