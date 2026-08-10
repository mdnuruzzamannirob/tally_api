import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { Express } from "express";

import { env } from "./config/env.js";
import { createEmailService } from "./email/email.service.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { notFoundMiddleware } from "./middleware/not-found.middleware.js";
import { requestIdMiddleware } from "./middleware/request-id.middleware.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createConnectedAccountsRouter } from "./modules/auth/connected-accounts.routes.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { createUsersRouter } from "./modules/users/users.routes.js";
import { createApplicationsRouter } from "./modules/applications/application.routes.js";
import { ApplicationService } from "./modules/applications/application.service.js";
import { createApplicationTagRouter } from "./modules/tags/application-tag.routes.js";
import { createTagsRouter } from "./modules/tags/tag.routes.js";
import { TagService } from "./modules/tags/tag.service.js";
import { createApplicationNotesRouter, createNotesRouter } from "./modules/notes/note.routes.js";
import { NoteService } from "./modules/notes/note.service.js";
import {
  createApplicationInterviewsRouter,
  createInterviewsRouter,
} from "./modules/interviews/interview.routes.js";
import { InterviewService } from "./modules/interviews/interview.service.js";
import { createDashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { DashboardService } from "./modules/dashboard/dashboard.service.js";
import { createGoogleOAuthRouter } from "./oauth/google-oauth.routes.js";
import { GoogleOAuthService } from "./oauth/google-oauth.service.js";
import { GoogleOAuthHttpClient } from "./oauth/google.oauth.js";
import { createGitHubOAuthRouter } from "./oauth/github-oauth.routes.js";
import { GitHubOAuthService } from "./oauth/github-oauth.service.js";
import { GitHubOAuthHttpClient } from "./oauth/github.oauth.js";
import { createHealthRouter } from "./routes/health.routes.js";

export interface AppDependencies {
  checkDatabase?: () => Promise<void>;
  authService?: AuthService;
  googleOAuthService?: GoogleOAuthService;
  githubOAuthService?: GitHubOAuthService;
  applicationService?: ApplicationService;
  tagService?: TagService;
  noteService?: NoteService;
  interviewService?: InterviewService;
  dashboardService?: DashboardService;
}

const defaultDatabaseCheck = async (): Promise<void> => {
  const { prisma } = await import("./lib/prisma.js");
  await prisma.$queryRaw`SELECT 1`;
};

export function createApp({
  checkDatabase = defaultDatabaseCheck,
  authService,
  googleOAuthService,
  githubOAuthService,
  applicationService,
  tagService,
  noteService,
  interviewService,
  dashboardService,
}: AppDependencies = {}): Express {
  const app = express();
  const resolvedAuthService = authService ?? new AuthService(prisma, createEmailService());
  const resolvedGoogleOAuthService =
    googleOAuthService ?? new GoogleOAuthService(prisma, new GoogleOAuthHttpClient());
  const resolvedGitHubOAuthService =
    githubOAuthService ?? new GitHubOAuthService(prisma, new GitHubOAuthHttpClient());
  const resolvedApplicationService = applicationService ?? new ApplicationService(prisma);
  const resolvedTagService = tagService ?? new TagService(prisma);
  const resolvedNoteService = noteService ?? new NoteService(prisma);
  const resolvedInterviewService = interviewService ?? new InterviewService(prisma);
  const resolvedDashboardService = dashboardService ?? new DashboardService(prisma);

  app.disable("x-powered-by");
  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      customProps: (request) => ({ requestId: request.requestId }),
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: env.WEB_APP_URL,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(compression());

  app.use("/api/v1", createHealthRouter(checkDatabase));
  app.use("/api/v1/auth", createAuthRouter(resolvedAuthService));
  app.use(
    "/api/v1/auth",
    createConnectedAccountsRouter(
      resolvedAuthService,
      resolvedGoogleOAuthService,
      resolvedGitHubOAuthService,
    ),
  );
  app.use("/api/v1/auth", createGoogleOAuthRouter(resolvedGoogleOAuthService));
  app.use("/api/v1/auth", createGitHubOAuthRouter(resolvedGitHubOAuthService));
  app.use("/api/v1/users", createUsersRouter(resolvedAuthService));
  app.use("/api/v1/applications", createApplicationsRouter(resolvedApplicationService));
  app.use("/api/v1/applications", createApplicationTagRouter(resolvedTagService));
  app.use("/api/v1/applications", createApplicationNotesRouter(resolvedNoteService));
  app.use("/api/v1/applications", createApplicationInterviewsRouter(resolvedInterviewService));
  app.use("/api/v1/tags", createTagsRouter(resolvedTagService));
  app.use("/api/v1", createNotesRouter(resolvedNoteService));
  app.use("/api/v1", createInterviewsRouter(resolvedInterviewService));
  app.use("/api/v1/dashboard", createDashboardRouter(resolvedDashboardService));
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}

export const app: Express = createApp();
