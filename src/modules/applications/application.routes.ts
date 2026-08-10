import { Router } from "express";

import { ApiError } from "../../lib/api-error.js";
import { sendSuccess } from "../../lib/api-response.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import type { ApplicationService } from "./application.service.js";
import {
  changeApplicationStatusSchema,
  createApplicationSchema,
  listApplicationsQuerySchema,
  updateApplicationSchema,
} from "./application.validators.js";

function userIdOrThrow(request: Express.Request): string {
  if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
  return request.auth.userId;
}

export function createApplicationsRouter(applicationService: ApplicationService): Router {
  const router = Router();
  router.get(
    "/",
    authenticate,
    asyncHandler(async (request, response) => {
      const query = listApplicationsQuerySchema.parse(request.query);
      const result = await applicationService.list(userIdOrThrow(request), query);
      const meta = {
        page: query.page,
        limit: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      };
      return sendSuccess(
        response,
        {
          items: result.items,
          pagination: { ...meta, pageSize: query.pageSize },
        },
        {
          message: "Applications retrieved successfully.",
          meta,
        },
      );
    }),
  );
  router.post(
    "/",
    authenticate,
    asyncHandler(async (request, response) => {
      const application = await applicationService.create(
        userIdOrThrow(request),
        createApplicationSchema.parse(request.body),
      );
      return sendSuccess(response, { application }, 201);
    }),
  );
  router.get(
    "/:id",
    authenticate,
    asyncHandler(async (request, response) => {
      if (typeof request.params.id !== "string" || !request.params.id) {
        throw new ApiError(400, "BAD_REQUEST", "Application ID is required.");
      }
      return sendSuccess(response, {
        application: await applicationService.getById(userIdOrThrow(request), request.params.id),
      });
    }),
  );
  router.patch(
    "/:id",
    authenticate,
    asyncHandler(async (request, response) => {
      if (typeof request.params.id !== "string" || !request.params.id) {
        throw new ApiError(400, "BAD_REQUEST", "Application ID is required.");
      }
      const application = await applicationService.update(
        userIdOrThrow(request),
        request.params.id,
        updateApplicationSchema.parse(request.body),
      );
      return sendSuccess(response, { application });
    }),
  );
  router.post(
    "/:id/status",
    authenticate,
    asyncHandler(async (request, response) => {
      if (typeof request.params.id !== "string" || !request.params.id) {
        throw new ApiError(400, "BAD_REQUEST", "Application ID is required.");
      }
      const application = await applicationService.changeStatus(
        userIdOrThrow(request),
        request.params.id,
        changeApplicationStatusSchema.parse(request.body),
      );
      return sendSuccess(response, { application });
    }),
  );
  router.get(
    "/:id/history",
    authenticate,
    asyncHandler(async (request, response) => {
      if (typeof request.params.id !== "string" || !request.params.id) {
        throw new ApiError(400, "BAD_REQUEST", "Application ID is required.");
      }
      return sendSuccess(response, {
        history: await applicationService.getHistory(userIdOrThrow(request), request.params.id),
      });
    }),
  );
  router.post(
    "/:id/archive",
    authenticate,
    asyncHandler(async (request, response) => {
      if (typeof request.params.id !== "string" || !request.params.id) {
        throw new ApiError(400, "BAD_REQUEST", "Application ID is required.");
      }
      await applicationService.archive(userIdOrThrow(request), request.params.id);
      return sendSuccess(response, { message: "Application archived" });
    }),
  );
  router.post(
    "/:id/unarchive",
    authenticate,
    asyncHandler(async (request, response) => {
      if (typeof request.params.id !== "string" || !request.params.id) {
        throw new ApiError(400, "BAD_REQUEST", "Application ID is required.");
      }
      await applicationService.unarchive(userIdOrThrow(request), request.params.id);
      return sendSuccess(response, { message: "Application unarchived" });
    }),
  );
  router.delete(
    "/:id",
    authenticate,
    asyncHandler(async (request, response) => {
      if (typeof request.params.id !== "string" || !request.params.id) {
        throw new ApiError(400, "BAD_REQUEST", "Application ID is required.");
      }
      await applicationService.delete(userIdOrThrow(request), request.params.id);
      return sendSuccess(response, { message: "Application deleted" });
    }),
  );
  return router;
}
