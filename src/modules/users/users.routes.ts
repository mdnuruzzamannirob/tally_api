import { Router } from "express";

import { authenticate } from "../../http/middleware/auth.middleware.js";
import { createUserController } from "./users.controller.js";
import type { UserService } from "./users.service.js";

export function createUsersRouter(userService: UserService): Router {
  const router = Router();
  const controller = createUserController(userService);
  router.patch("/me/profile", authenticate, controller.updateProfile);
  router.patch("/me/preferences", authenticate, controller.updatePreferences);
  return router;
}
