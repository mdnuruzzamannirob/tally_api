import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { Express } from "express";

import { env } from "./config/env.js";
import {
  ALLOWED_REQUEST_HEADERS,
  API_PREFIX,
  JSON_BODY_LIMIT,
  SUPPORTED_HTTP_METHODS,
} from "./config/constants.js";
import { createEmailService } from "./email/email.service.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { notFoundMiddleware } from "./middleware/not-found.middleware.js";
import { requestIdMiddleware } from "./middleware/request-id.middleware.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { AuthRepository } from "./modules/auth/auth.repository.js";
import { UserRepository } from "./modules/users/user.repository.js";
import { UserService } from "./modules/users/user.service.js";
import { ApplicationService } from "./modules/applications/application.service.js";
import { ApplicationRepository } from "./modules/applications/application.repository.js";
import { TagService } from "./modules/tags/tag.service.js";
import { TagRepository } from "./modules/tags/tag.repository.js";
import { NoteService } from "./modules/notes/note.service.js";
import { InterviewService } from "./modules/interviews/interview.service.js";
import { DashboardService } from "./modules/dashboard/dashboard.service.js";
import { ExportService } from "./modules/export-import/export.service.js";
import { ImportService } from "./modules/export-import/import.service.js";
import { GoogleOAuthService } from "./oauth/google-oauth.service.js";
import { GoogleOAuthHttpClient } from "./oauth/google.oauth.js";
import { GitHubOAuthService } from "./oauth/github-oauth.service.js";
import { GitHubOAuthHttpClient } from "./oauth/github.oauth.js";
import { OAuthRepository } from "./oauth/oauth.repository.js";
import { createApiRouter } from "./routes/index.js";

export interface AppDependencies {
  checkDatabase?: () => Promise<void>;
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

const defaultDatabaseCheck = async (): Promise<void> => {
  const { prisma } = await import("./lib/prisma.js");
  await prisma.$queryRaw`SELECT 1`;
};

export function createApp({
  checkDatabase = defaultDatabaseCheck,
  authService,
  userService,
  googleOAuthService,
  githubOAuthService,
  applicationService,
  tagService,
  noteService,
  interviewService,
  dashboardService,
  exportService,
  importService,
}: AppDependencies = {}): Express {
  const app = express();
  const authRepository = new AuthRepository(prisma);
  const userRepository = new UserRepository(prisma);
  const oauthRepository = new OAuthRepository(prisma);
  const applicationRepository = new ApplicationRepository(prisma);
  const tagRepository = new TagRepository(prisma);
  const resolvedAuthService = authService ?? new AuthService(authRepository, createEmailService());
  const resolvedUserService = userService ?? new UserService(userRepository);
  const resolvedGoogleOAuthService =
    googleOAuthService ?? new GoogleOAuthService(oauthRepository, new GoogleOAuthHttpClient());
  const resolvedGitHubOAuthService =
    githubOAuthService ?? new GitHubOAuthService(oauthRepository, new GitHubOAuthHttpClient());
  const resolvedApplicationService =
    applicationService ?? new ApplicationService(applicationRepository);
  const resolvedTagService = tagService ?? new TagService(tagRepository);
  const resolvedNoteService = noteService ?? new NoteService(prisma);
  const resolvedInterviewService = interviewService ?? new InterviewService(prisma);
  const resolvedDashboardService = dashboardService ?? new DashboardService(prisma);
  const resolvedExportService = exportService ?? new ExportService(prisma);
  const resolvedImportService = importService ?? new ImportService(prisma);

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
      methods: SUPPORTED_HTTP_METHODS,
      allowedHeaders: ALLOWED_REQUEST_HEADERS,
    }),
  );
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(cookieParser());
  app.use(compression());

  app.use(
    API_PREFIX,
    createApiRouter({
      checkDatabase,
      authService: resolvedAuthService,
      userService: resolvedUserService,
      googleOAuthService: resolvedGoogleOAuthService,
      githubOAuthService: resolvedGitHubOAuthService,
      applicationService: resolvedApplicationService,
      tagService: resolvedTagService,
      noteService: resolvedNoteService,
      interviewService: resolvedInterviewService,
      dashboardService: resolvedDashboardService,
      exportService: resolvedExportService,
      importService: resolvedImportService,
    }),
  );
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}

export const app: Express = createApp();
