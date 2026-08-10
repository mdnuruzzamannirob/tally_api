import { Router } from "express";

import { createEmailService } from "../email/email.service.js";
import { prisma } from "../lib/prisma.js";
import { globalApiRateLimit } from "../middleware/global-rate-limit.middleware.js";
import { ApplicationRepository } from "../modules/applications/application.repository.js";
import { createApplicationsRouter } from "../modules/applications/application.routes.js";
import { ApplicationService } from "../modules/applications/application.service.js";
import { AuthRepository } from "../modules/auth/auth.repository.js";
import { createAuthRouter } from "../modules/auth/auth.routes.js";
import { AuthService } from "../modules/auth/auth.service.js";
import { createConnectedAccountsRouter } from "../modules/auth/connected-accounts.routes.js";
import { createGitHubOAuthRouter } from "../modules/auth/oauth/github-oauth.routes.js";
import { GitHubOAuthService } from "../modules/auth/oauth/github-oauth.service.js";
import { GitHubOAuthHttpClient } from "../modules/auth/oauth/github.oauth.js";
import { createGoogleOAuthRouter } from "../modules/auth/oauth/google-oauth.routes.js";
import { GoogleOAuthService } from "../modules/auth/oauth/google-oauth.service.js";
import { GoogleOAuthHttpClient } from "../modules/auth/oauth/google.oauth.js";
import { OAuthRepository } from "../modules/auth/oauth/oauth.repository.js";
import { DashboardRepository } from "../modules/dashboard/dashboard.repository.js";
import { createDashboardRouter } from "../modules/dashboard/dashboard.routes.js";
import { DashboardService } from "../modules/dashboard/dashboard.service.js";
import { ExportRepository } from "../modules/export-import/export.repository.js";
import { createExportRouter } from "../modules/export-import/export.routes.js";
import { ExportService } from "../modules/export-import/export.service.js";
import { ImportRepository } from "../modules/export-import/import.repository.js";
import { createImportRouter } from "../modules/export-import/import.routes.js";
import { ImportService } from "../modules/export-import/import.service.js";
import { createHealthRouter } from "../modules/health/health.routes.js";
import { HealthService } from "../modules/health/health.service.js";
import { InterviewRepository } from "../modules/interviews/interview.repository.js";
import {
  createApplicationInterviewsRouter,
  createInterviewsRouter,
} from "../modules/interviews/interview.routes.js";
import { InterviewService } from "../modules/interviews/interview.service.js";
import { NoteRepository } from "../modules/notes/note.repository.js";
import { createApplicationNotesRouter, createNotesRouter } from "../modules/notes/note.routes.js";
import { NoteService } from "../modules/notes/note.service.js";
import { createApplicationTagRouter } from "../modules/tags/application-tag.routes.js";
import { TagRepository } from "../modules/tags/tag.repository.js";
import { createTagsRouter } from "../modules/tags/tag.routes.js";
import { TagService } from "../modules/tags/tag.service.js";
import { UserRepository } from "../modules/users/user.repository.js";
import { UserService } from "../modules/users/user.service.js";
import { createUsersRouter } from "../modules/users/users.routes.js";
import { createOpenApiRouter } from "./openapi.routes.js";

export interface AppDependencies {
  checkDatabase?: () => Promise<void>;
  healthService?: HealthService;
  authService?: AuthService;
  userService?: UserService;
  googleOAuthService?: GoogleOAuthService;
  githubOAuthService?: GitHubOAuthService;
  applicationService?: ApplicationService;
  tagService?: TagService;
  noteService?: NoteService;
  interviewService?: InterviewService;
  dashboardService?: DashboardService;
  exportService?: ExportService;
  importService?: ImportService;
}

type ResolvedAppDependencies = Required<Omit<AppDependencies, "checkDatabase">>;

const defaultDatabaseCheck = async (): Promise<void> => {
  await prisma.$queryRaw`SELECT 1`;
};

function createAppDependencies(overrides: AppDependencies = {}): ResolvedAppDependencies {
  const oauthRepository = new OAuthRepository(prisma);
  const dependencies: ResolvedAppDependencies = {
    healthService: new HealthService(overrides.checkDatabase ?? defaultDatabaseCheck),
    authService: new AuthService(new AuthRepository(prisma), createEmailService()),
    userService: new UserService(new UserRepository(prisma)),
    googleOAuthService: new GoogleOAuthService(oauthRepository, new GoogleOAuthHttpClient()),
    githubOAuthService: new GitHubOAuthService(oauthRepository, new GitHubOAuthHttpClient()),
    applicationService: new ApplicationService(new ApplicationRepository(prisma)),
    tagService: new TagService(new TagRepository(prisma)),
    noteService: new NoteService(new NoteRepository(prisma)),
    interviewService: new InterviewService(new InterviewRepository(prisma)),
    dashboardService: new DashboardService(new DashboardRepository(prisma)),
    exportService: new ExportService(new ExportRepository(prisma)),
    importService: new ImportService(new ImportRepository(prisma)),
  };

  return {
    ...dependencies,
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== "checkDatabase")),
  } as ResolvedAppDependencies;
}

/** Mounts every feature router below the API version prefix. */
export function createApiRouter(overrides: AppDependencies = {}): Router {
  const dependencies = createAppDependencies(overrides);
  const router = Router();
  router.use(globalApiRateLimit);
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

/** Default production router. Tests can use createApiRouter with injected dependencies. */
export const appRouter = createApiRouter();
