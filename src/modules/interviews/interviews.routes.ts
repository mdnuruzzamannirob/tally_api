import { Router } from "express";

import { asyncHandler } from "../../http/async-handler.js";
import { authenticate } from "../../http/middleware/auth.middleware.js";
import { InterviewController } from "./interviews.controller.js";
import type { InterviewService } from "./interviews.service.js";

export function createApplicationInterviewsRouter(interviewService: InterviewService): Router {
  const controller = new InterviewController(interviewService);
  const router = Router();
  router.get(
    "/:id/interviews",
    authenticate,
    asyncHandler((request, response) => controller.listApplication(request, response)),
  );
  router.post(
    "/:id/interviews",
    authenticate,
    asyncHandler((request, response) => controller.create(request, response)),
  );
  return router;
}

export function createInterviewsRouter(interviewService: InterviewService): Router {
  const controller = new InterviewController(interviewService);
  const router = Router();
  router.get(
    "/interviews",
    authenticate,
    asyncHandler((request, response) => controller.list(request, response)),
  );
  router.patch(
    "/interviews/:id",
    authenticate,
    asyncHandler((request, response) => controller.update(request, response)),
  );
  router.delete(
    "/interviews/:id",
    authenticate,
    asyncHandler((request, response) => controller.delete(request, response)),
  );
  return router;
}
