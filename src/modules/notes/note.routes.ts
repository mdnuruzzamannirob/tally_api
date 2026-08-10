import { Router, type Request } from "express";

import { authenticate } from "../../middleware/auth.middleware.js";
import { ApiError } from "../../utils/api-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { sendSuccess } from "../../utils/api-response.js";
import type { NoteService } from "./note.service.js";
import { createNoteSchema, updateNoteSchema } from "./note.validators.js";

function userIdOrThrow(request: Request): string {
  if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
  return request.auth.userId;
}

function applicationIdOrThrow(request: Request): string {
  if (typeof request.params.id !== "string" || !request.params.id)
    throw new ApiError(400, "BAD_REQUEST", "Application ID is required.");
  return request.params.id;
}

export function createApplicationNotesRouter(noteService: NoteService): Router {
  const router = Router();
  router.get(
    "/:id/notes",
    authenticate,
    asyncHandler(async (request, response) => {
      const notes = await noteService.list(userIdOrThrow(request), applicationIdOrThrow(request));
      return sendSuccess(response, { notes });
    }),
  );
  router.post(
    "/:id/notes",
    authenticate,
    asyncHandler(async (request, response) => {
      const note = await noteService.create(
        userIdOrThrow(request),
        applicationIdOrThrow(request),
        createNoteSchema.parse(request.body),
      );
      return sendSuccess(response, { note }, 201);
    }),
  );
  return router;
}

export function createNotesRouter(noteService: NoteService): Router {
  const router = Router();
  router.patch(
    "/notes/:id",
    authenticate,
    asyncHandler(async (request, response) => {
      if (typeof request.params.id !== "string" || !request.params.id)
        throw new ApiError(400, "BAD_REQUEST", "Note ID is required.");
      const note = await noteService.update(
        userIdOrThrow(request),
        request.params.id,
        updateNoteSchema.parse(request.body),
      );
      return sendSuccess(response, { note });
    }),
  );
  router.delete(
    "/notes/:id",
    authenticate,
    asyncHandler(async (request, response) => {
      if (typeof request.params.id !== "string" || !request.params.id)
        throw new ApiError(400, "BAD_REQUEST", "Note ID is required.");
      await noteService.delete(userIdOrThrow(request), request.params.id);
      return sendSuccess(response, { message: "Note deleted" });
    }),
  );
  return router;
}
