import { Router } from "express";

import { authenticate } from "../../middleware/auth.middleware.js";
import { createUserController } from "./user.controller.js";
import type { UserService } from "./user.service.js";

export function createUsersRouter(userService: UserService): Router {
  const router = Router();
  const controller = createUserController(userService);
  router.patch("/me/profile", authenticate, controller.updateProfile);
  router.patch("/me/preferences", authenticate, controller.updatePreferences);
  return router;
}
