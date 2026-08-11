import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import prettier from "prettier";

import { openApiRoutes } from "./openapi-routes.js";

const schema = (type: string, properties: Record<string, unknown>, required: string[] = []) => ({
  type,
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false,
});
const string = (format?: string) => ({ type: "string", ...(format ? { format } : {}) });
const enumSchema = (values: string[]) => ({ type: "string", enum: values });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const dataObject = (properties: Record<string, unknown> = {}) => ({
  type: "object",
  properties,
  additionalProperties: true,
});

const requestExamples: Record<string, unknown> = {
  Register: { name: "Nirob Hasan", email: "nirob@example.com", password: "StrongPass123!" },
  Login: { email: "nirob@example.com", password: "StrongPass123!" },
  Email: { email: "nirob@example.com" },
  Token: { token: "{{verificationToken}}" },
  ResetPassword: { token: "{{resetToken}}", password: "NewStrongPass123!" },
  ChangePassword: {
    currentPassword: "StrongPass123!",
    newPassword: "NewStrongPass123!",
  },
  SetPassword: { newPassword: "StrongPass123!" },
  Profile: { name: "Nirob Hasan" },
  Preferences: {
    theme: "dark",
    defaultLandingPage: "dashboard",
    timeZone: "Asia/Dhaka",
    notificationsEnabled: true,
  },
  CreateApplication: {
    company: "OpenAI",
    role: "Software Engineer",
    jobUrl: "https://example.com/jobs/software-engineer",
    location: "Remote",
    remoteType: "REMOTE",
    employmentType: "FULL_TIME",
    source: "LinkedIn",
    status: "APPLIED",
    appliedAt: "2026-08-11",
    salaryMin: 90000,
    salaryMax: 120000,
    currency: "USD",
    initialNote: "Submitted through the careers page.",
  },
  UpdateApplication: {
    role: "Senior Software Engineer",
    nextFollowUpAt: "2026-08-18T09:00:00.000Z",
  },
  ChangeStatus: { toStatus: "INTERVIEW", note: "Technical interview scheduled." },
  CreateTag: { name: "priority", color: "#2563EB" },
  UpdateTag: { name: "high-priority", color: "#DC2626" },
  AddTags: { tagIds: ["{{tagId}}"] },
  Note: { content: "Follow up with the recruiter next week." },
  CreateInterview: {
    type: "TECHNICAL",
    scheduledAt: "2026-08-20T10:00:00.000Z",
    interviewerName: "Alex Morgan",
    meetingLink: "https://meet.example.com/tally-interview",
    status: "SCHEDULED",
  },
  UpdateInterview: { status: "COMPLETED", notes: "Strong technical discussion." },
  ImportBackup: {
    version: 1,
    exportedAt: "2026-08-11T00:00:00.000Z",
    profile: {
      name: "Nirob Hasan",
      preferences: {
        theme: "DARK",
        defaultLandingPage: "DASHBOARD",
        timeZone: "Asia/Dhaka",
        notificationsEnabled: true,
      },
    },
    tags: [],
    applications: [],
  },
};

const successExamples: Record<string, unknown> = {
  health: { status: "ok", database: "connected", timestamp: "2026-08-11T00:00:00.000Z" },
  register: { message: "Registration successful. Please verify your email." },
  login: {
    accessToken: "eyJhbGciOiJIUzI1NiJ9.example.signature",
    user: {
      id: "cm0user123",
      name: "Nirob Hasan",
      email: "nirob@example.com",
      emailVerified: true,
      hasPassword: true,
      providers: [],
      preferences: {
        theme: "dark",
        defaultLandingPage: "dashboard",
        timeZone: "Asia/Dhaka",
        notificationsEnabled: true,
      },
    },
  },
  refresh: { accessToken: "eyJhbGciOiJIUzI1NiJ9.refreshed.signature" },
  createApplication: {
    application: {
      id: "cm0application123",
      company: "OpenAI",
      role: "Software Engineer",
      status: "APPLIED",
    },
  },
  createTag: { tag: { id: "cm0tag123", name: "priority", color: "#2563EB" } },
  createNote: { note: { id: "cm0note123", content: "Follow up with the recruiter." } },
  createInterview: {
    interview: {
      id: "cm0interview123",
      type: "TECHNICAL",
      status: "SCHEDULED",
      scheduledAt: "2026-08-20T10:00:00.000Z",
    },
  },
};

const operationTag = (path: string) => {
  const segment = path.split("/").filter(Boolean)[0] ?? "system";
  return (
    {
      auth: "Authentication",
      users: "Users",
      applications: "Applications",
      tags: "Tags",
      notes: "Notes",
      interviews: "Interviews",
      dashboard: "Dashboard",
      export: "Export & Import",
      import: "Export & Import",
      health: "System",
    }[segment] ?? "System"
  );
};

const operationSummary = (operationId: string) =>
  operationId.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (value) => value.toUpperCase());

const schemas: Record<string, unknown> = {
  Register: schema("object", { name: string(), email: string("email"), password: string() }, [
    "email",
    "password",
  ]),
  Login: schema("object", { email: string("email"), password: string() }, ["email", "password"]),
  Email: schema("object", { email: string("email") }, ["email"]),
  Token: schema("object", { token: string() }, ["token"]),
  ResetPassword: schema("object", { token: string(), password: string() }, ["token", "password"]),
  ChangePassword: schema("object", { currentPassword: string(), newPassword: string() }, [
    "currentPassword",
    "newPassword",
  ]),
  SetPassword: schema("object", { newPassword: string() }, ["newPassword"]),
  Profile: schema("object", { name: string() }, ["name"]),
  Preferences: schema("object", {
    theme: enumSchema(["light", "dark", "system"]),
    defaultLandingPage: enumSchema(["dashboard", "applications"]),
    timeZone: string(),
    notificationsEnabled: { type: "boolean" },
  }),
  CreateApplication: schema(
    "object",
    {
      company: string(),
      role: string(),
      jobUrl: string("uri"),
      location: string(),
      remoteType: enumSchema(["ONSITE", "REMOTE", "HYBRID"]),
      employmentType: enumSchema(["FULL_TIME", "CONTRACT", "INTERNSHIP"]),
      source: string(),
      status: enumSchema([
        "WISHLIST",
        "APPLIED",
        "SCREENING",
        "INTERVIEW",
        "OFFER",
        "REJECTED",
        "WITHDRAWN",
      ]),
      appliedAt: string("date"),
      salaryMin: { type: "number", minimum: 0 },
      salaryMax: { type: "number", minimum: 0 },
      currency: { type: "string", pattern: "^[A-Z]{3}$" },
      nextFollowUpAt: string("date-time"),
      tagIds: { type: "array", items: string() },
      initialNote: string(),
    },
    ["company", "role"],
  ),
  UpdateApplication: schema("object", {
    company: string(),
    role: string(),
    jobUrl: { type: ["string", "null"], format: "uri" },
    location: { type: ["string", "null"] },
    remoteType: { type: ["string", "null"], enum: ["ONSITE", "REMOTE", "HYBRID", null] },
    employmentType: {
      type: ["string", "null"],
      enum: ["FULL_TIME", "CONTRACT", "INTERNSHIP", null],
    },
    source: { type: ["string", "null"] },
    appliedAt: { type: ["string", "null"], format: "date" },
    salaryMin: { type: ["number", "null"], minimum: 0 },
    salaryMax: { type: ["number", "null"], minimum: 0 },
    currency: { type: ["string", "null"], pattern: "^[A-Z]{3}$" },
    nextFollowUpAt: { type: ["string", "null"], format: "date-time" },
    tagIds: { type: "array", items: string() },
  }),
  ChangeStatus: schema(
    "object",
    {
      toStatus: enumSchema([
        "WISHLIST",
        "APPLIED",
        "SCREENING",
        "INTERVIEW",
        "OFFER",
        "REJECTED",
        "WITHDRAWN",
      ]),
      note: string(),
    },
    ["toStatus"],
  ),
  CreateTag: schema(
    "object",
    { name: string(), color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" } },
    ["name"],
  ),
  UpdateTag: schema("object", {
    name: string(),
    color: { type: ["string", "null"], pattern: "^#[0-9a-fA-F]{6}$" },
  }),
  AddTags: schema("object", { tagIds: { type: "array", minItems: 1, items: string() } }, [
    "tagIds",
  ]),
  Note: schema("object", { content: string() }, ["content"]),
  CreateInterview: schema(
    "object",
    {
      type: enumSchema(["PHONE", "TECHNICAL", "HR", "SYSTEM_DESIGN", "ONSITE", "OTHER"]),
      scheduledAt: string("date-time"),
      interviewerName: string(),
      meetingLink: string("uri"),
      location: string(),
      notes: string(),
      status: enumSchema(["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]),
    },
    ["type", "scheduledAt"],
  ),
  UpdateInterview: schema("object", {
    type: enumSchema(["PHONE", "TECHNICAL", "HR", "SYSTEM_DESIGN", "ONSITE", "OTHER"]),
    scheduledAt: string("date-time"),
    interviewerName: { type: ["string", "null"] },
    meetingLink: { type: ["string", "null"], format: "uri" },
    location: { type: ["string", "null"] },
    notes: { type: ["string", "null"] },
    status: enumSchema(["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]),
  }),
  ImportBackup: {
    type: "object",
    required: ["version", "exportedAt", "profile", "tags", "applications"],
    properties: {
      version: { const: 1 },
      exportedAt: string("date-time"),
      profile: { type: "object" },
      tags: { type: "array" },
      applications: { type: "array" },
    },
    additionalProperties: false,
  },
  SuccessEnvelope: schema(
    "object",
    {
      success: { const: true },
      message: string(),
      data: { type: "object", additionalProperties: true },
      meta: ref("Meta"),
    },
    ["success", "message", "data"],
  ),
  ErrorEnvelope: schema(
    "object",
    {
      success: { const: false },
      message: string(),
      error: {
        type: "object",
        properties: { code: string(), details: { type: "object" } },
        required: ["code"],
      },
      meta: ref("Meta"),
    },
    ["success", "message", "error", "meta"],
  ),
  Meta: schema("object", {
    requestId: string(),
    page: { type: "integer" },
    limit: { type: "integer" },
    total: { type: "integer" },
    totalPages: { type: "integer" },
  }),
  MessageData: dataObject({ message: string() }),
  UserData: dataObject({ user: dataObject() }),
  AuthData: dataObject({ accessToken: string(), user: dataObject() }),
  AccessTokenData: dataObject({ accessToken: string() }),
  ConnectedAccountsData: dataObject({
    providers: { type: "array", items: dataObject() },
    hasPassword: { type: "boolean" },
  }),
  AuthorizationUrlData: dataObject({ authorizationUrl: string("uri") }),
  ApplicationData: dataObject({ application: dataObject() }),
  ApplicationsData: dataObject({
    items: { type: "array", items: dataObject() },
    pagination: dataObject(),
  }),
  HistoryData: dataObject({ history: { type: "array", items: dataObject() } }),
  TagsData: dataObject({ tags: { type: "array", items: dataObject() } }),
  TagData: dataObject({ tag: dataObject() }),
  NotesData: dataObject({ notes: { type: "array", items: dataObject() } }),
  NoteData: dataObject({ note: dataObject() }),
  InterviewsData: dataObject({
    items: { type: "array", items: dataObject() },
    pagination: dataObject(),
  }),
  InterviewData: dataObject({ interview: dataObject() }),
  DashboardData: dataObject(),
};

const responseDataByOperation: Record<string, string> = {
  register: "MessageData",
  login: "AuthData",
  logout: "MessageData",
  refresh: "AccessTokenData",
  getCurrentUser: "UserData",
  verifyEmail: "MessageData",
  resendVerification: "MessageData",
  forgotPassword: "MessageData",
  resetPassword: "MessageData",
  changePassword: "MessageData",
  setPassword: "MessageData",
  listConnectedAccounts: "ConnectedAccountsData",
  linkConnectedAccount: "AuthorizationUrlData",
  unlinkConnectedAccount: "MessageData",
  updateProfile: "UserData",
  updatePreferences: "UserData",
  listApplications: "ApplicationsData",
  createApplication: "ApplicationData",
  getApplication: "ApplicationData",
  updateApplication: "ApplicationData",
  deleteApplication: "MessageData",
  archiveApplication: "MessageData",
  unarchiveApplication: "MessageData",
  changeApplicationStatus: "ApplicationData",
  getApplicationHistory: "HistoryData",
  listTags: "TagsData",
  createTag: "TagData",
  updateTag: "TagData",
  deleteTag: "MessageData",
  addApplicationTags: "TagsData",
  removeApplicationTag: "MessageData",
  listApplicationNotes: "NotesData",
  createNote: "NoteData",
  updateNote: "NoteData",
  deleteNote: "MessageData",
  listInterviews: "InterviewsData",
  listApplicationInterviews: "InterviewsData",
  createInterview: "InterviewData",
  updateInterview: "InterviewData",
  deleteInterview: "MessageData",
  getDashboard: "DashboardData",
  importJson: "MessageData",
};

const requestBody = (name: string) => ({
  required: true,
  content: {
    "application/json": {
      schema: ref(name),
      ...(requestExamples[name] ? { example: requestExamples[name] } : {}),
    },
  },
});
const parameters = (route: (typeof openApiRoutes)[number]) => [
  ...(route.params ?? []).map((name) => ({ name, in: "path", required: true, schema: string() })),
  ...(route.query ?? []).map((name) => ({ name, in: "query", required: false, schema: string() })),
];
const errorResponseRefs = (route: (typeof openApiRoutes)[number]) => {
  const responses: Record<string, unknown> = {
    "400": { $ref: "#/components/responses/BadRequest" },
    "429": { $ref: "#/components/responses/RateLimited" },
    "500": { $ref: "#/components/responses/InternalError" },
  };
  if (route.auth) {
    responses["401"] = { $ref: "#/components/responses/Unauthorized" };
    responses["403"] = { $ref: "#/components/responses/Forbidden" };
  }
  if (route.params?.length) responses["404"] = { $ref: "#/components/responses/NotFound" };
  if (route.method !== "get") responses["409"] = { $ref: "#/components/responses/Conflict" };
  if (route.operationId === "health") {
    responses["503"] = { $ref: "#/components/responses/ServiceUnavailable" };
  }
  return responses;
};

const response = (route: (typeof openApiRoutes)[number]) => {
  if (route.response === "redirect") {
    return {
      "302": {
        description: "Redirect to the configured OAuth provider or frontend callback.",
        headers: { Location: { schema: string("uri") } },
      },
      "429": { $ref: "#/components/responses/RateLimited" },
      "500": { $ref: "#/components/responses/InternalError" },
    };
  }

  if (route.response === "file") {
    return {
      "200": {
        description: "Downloadable export file.",
        headers: {
          "Content-Disposition": {
            description: "Attachment filename.",
            schema: string(),
          },
        },
        content: {
          "application/json": { schema: { type: "string", format: "binary" } },
          "text/csv": { schema: { type: "string", format: "binary" } },
        },
      },
      ...errorResponseRefs(route),
    };
  }

  const dataExample = successExamples[route.operationId] ?? { message: "Request completed." };
  return {
    [route.response === "created" ? "201" : "200"]: {
      description:
        route.response === "created"
          ? "Resource created successfully."
          : "Successful API response.",
      content: {
        "application/json": {
          schema: responseDataByOperation[route.operationId]
            ? {
                allOf: [
                  ref("SuccessEnvelope"),
                  { properties: { data: ref(responseDataByOperation[route.operationId]!) } },
                ],
              }
            : ref("SuccessEnvelope"),
          example: {
            success: true,
            message:
              route.response === "created"
                ? "Resource created successfully."
                : "Request completed successfully.",
            data: dataExample,
            meta: { requestId: "req_01HZXEXAMPLE" },
          },
        },
      },
    },
    ...errorResponseRefs(route),
  };
};

const errorResponse = (code: string, message: string) => ({
  description: message,
  content: {
    "application/json": {
      schema: ref("ErrorEnvelope"),
      example: {
        success: false,
        message,
        error: { code },
        meta: { requestId: "req_01HZXEXAMPLE" },
      },
    },
  },
});

const paths: Record<string, Record<string, unknown>> = {};
for (const route of openApiRoutes) {
  const pathItem = paths[route.path] ?? (paths[route.path] = {});
  pathItem[route.method] = {
    operationId: route.operationId,
    tags: [operationTag(route.path)],
    summary: operationSummary(route.operationId),
    description: `${operationSummary(route.operationId)} using the versioned Tally API.`,
    ...(route.auth
      ? { security: [{ [route.auth === "bearer" ? "bearerAuth" : "refreshCookieAuth"]: [] }] }
      : {}),
    ...(route.params || route.query ? { parameters: parameters(route) } : {}),
    ...(route.body ? { requestBody: requestBody(route.body) } : {}),
    responses: response(route),
  };
}

const document = {
  openapi: "3.1.0",
  info: {
    title: "Tally API",
    version: "1.0.0",
    description:
      "Complete REST contract for Tally. Use Bearer JWT authentication for protected endpoints; refresh and logout use the secure tally_rt cookie.",
    contact: { name: "Tally API Support" },
  },
  servers: [
    { url: "/api/v1", description: "Current host" },
    { url: "http://localhost:4000/api/v1", description: "Local development" },
  ],
  tags: [
    { name: "System", description: "Service health and operational endpoints." },
    { name: "Authentication", description: "Identity, sessions, passwords, and OAuth." },
    { name: "Users", description: "User profile and preferences." },
    { name: "Applications", description: "Job application lifecycle management." },
    { name: "Tags", description: "Application categorization." },
    { name: "Notes", description: "Application notes." },
    { name: "Interviews", description: "Interview scheduling and tracking." },
    { name: "Dashboard", description: "Aggregated user dashboard." },
    { name: "Export & Import", description: "Portable backup and CSV workflows." },
  ],
  paths,
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      refreshCookieAuth: { type: "apiKey", in: "cookie", name: "tally_rt" },
    },
    schemas,
    responses: {
      BadRequest: errorResponse("BAD_REQUEST", "The request is invalid."),
      Unauthorized: errorResponse("UNAUTHORIZED", "Authentication is required."),
      Forbidden: errorResponse("FORBIDDEN", "The authenticated user cannot perform this action."),
      NotFound: errorResponse("NOT_FOUND", "The requested resource was not found."),
      Conflict: errorResponse("CONFLICT", "The request conflicts with existing data."),
      RateLimited: errorResponse("RATE_LIMITED", "Too many requests."),
      InternalError: errorResponse("INTERNAL_ERROR", "An unexpected error occurred."),
      ServiceUnavailable: errorResponse("SERVICE_UNAVAILABLE", "Service temporarily unavailable."),
    },
  },
};

const outputPath = fileURLToPath(new URL("../contracts/openapi.json", import.meta.url));
await writeFile(
  outputPath,
  await prettier.format(JSON.stringify(document), {
    parser: "json",
    printWidth: 100,
    singleQuote: false,
    trailingComma: "all",
  }),
);
console.info(`Generated ${openApiRoutes.length} OpenAPI operations.`);
