import { Router } from "express";

import type { AppDependencies } from "../app.js";
import { createApplicationsRouter } from "../modules/applications/application.routes.js";
import { createAuthRouter } from "../modules/auth/auth.routes.js";
import { createConnectedAccountsRouter } from "../modules/auth/connected-accounts.routes.js";
import { createDashboardRouter } from "../modules/dashboard/dashboard.routes.js";
import { createExportRouter } from "../modules/export-import/export.routes.js";
import { createImportRouter } from "../modules/export-import/import.routes.js";
import {
  createApplicationInterviewsRouter,
  createInterviewsRouter,
} from "../modules/interviews/interview.routes.js";
import { createApplicationNotesRouter, createNotesRouter } from "../modules/notes/note.routes.js";
import { createApplicationTagRouter } from "../modules/tags/application-tag.routes.js";
import { createTagsRouter } from "../modules/tags/tag.routes.js";
import { createUsersRouter } from "../modules/users/users.routes.js";
import { createGitHubOAuthRouter } from "../oauth/github-oauth.routes.js";
import { createGoogleOAuthRouter } from "../oauth/google-oauth.routes.js";
import { createHealthRouter } from "./health.routes.js";
import type { HealthService } from "./health.service.js";
import { createOpenApiRouter } from "./openapi.routes.js";

type ResolvedDependencies = Required<AppDependencies>;

/** Mounts every feature router below the API version prefix. */
export function createApiRouter(dependencies: ResolvedDependencies): Router {
  const router = Router();
  router.use(createOpenApiRouter());
  router.use(createHealthRouter(dependencies.healthService));
  router.use("/auth", createAuthRouter(dependencies.authService));
  router.use(
    "/auth",
    createConnectedAccountsRouter(
      dependencies.authService,
      dependencies.googleOAuthService,
      dependencies.githubOAuthService,
    ),
  );
  router.use("/auth", createGoogleOAuthRouter(dependencies.googleOAuthService));
  router.use("/auth", createGitHubOAuthRouter(dependencies.githubOAuthService));
  router.use("/users", createUsersRouter(dependencies.userService));
  router.use("/applications", createApplicationsRouter(dependencies.applicationService));
  router.use("/applications", createApplicationTagRouter(dependencies.tagService));
  router.use("/applications", createApplicationNotesRouter(dependencies.noteService));
  router.use("/applications", createApplicationInterviewsRouter(dependencies.interviewService));
  router.use("/tags", createTagsRouter(dependencies.tagService));
  router.use(createNotesRouter(dependencies.noteService));
  router.use(createInterviewsRouter(dependencies.interviewService));
  router.use("/dashboard", createDashboardRouter(dependencies.dashboardService));
  router.use("/export", createExportRouter(dependencies.exportService));
  router.use("/import", createImportRouter(dependencies.importService));
  return router;
}
