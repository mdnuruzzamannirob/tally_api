import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { NoteController } from "./note.controller.js";
import type { NoteService } from "./note.service.js";

export function createApplicationNotesRouter(noteService: NoteService): Router {
  const controller = new NoteController(noteService);
  const router = Router();
  router.get(
    "/:id/notes",
    authenticate,
    asyncHandler((request, response) => controller.list(request, response)),
  );
  router.post(
    "/:id/notes",
    authenticate,
    asyncHandler((request, response) => controller.create(request, response)),
  );
  return router;
}

export function createNotesRouter(noteService: NoteService): Router {
  const controller = new NoteController(noteService);
  const router = Router();
  router.patch(
    "/notes/:id",
    authenticate,
    asyncHandler((request, response) => controller.update(request, response)),
  );
  router.delete(
    "/notes/:id",
    authenticate,
    asyncHandler((request, response) => controller.delete(request, response)),
  );
  return router;
}
