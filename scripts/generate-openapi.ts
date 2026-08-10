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
  createTag: "TagsData",
  updateTag: "TagsData",
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
  content: { "application/json": { schema: ref(name) } },
});
const parameters = (route: (typeof openApiRoutes)[number]) => [
  ...(route.params ?? []).map((name) => ({ name, in: "path", required: true, schema: string() })),
  ...(route.query ?? []).map((name) => ({ name, in: "query", required: false, schema: string() })),
];
const response = (route: (typeof openApiRoutes)[number]) =>
  route.response === "redirect"
    ? { "302": { description: "Redirect to the configured OAuth provider or frontend callback." } }
    : route.response === "file"
      ? {
          "200": {
            description: "Downloadable export file.",
            content: {
              "application/json": { schema: { type: "string", format: "binary" } },
              "text/csv": { schema: { type: "string", format: "binary" } },
            },
          },
        }
      : {
          [route.response === "created" ? "201" : "200"]: {
            description: "Successful API response.",
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
              },
            },
          },
          "400": { $ref: "#/components/responses/Error" },
          "401": { $ref: "#/components/responses/Error" },
        };

const paths: Record<string, Record<string, unknown>> = {};
for (const route of openApiRoutes) {
  const pathItem = paths[route.path] ?? (paths[route.path] = {});
  pathItem[route.method] = {
    operationId: route.operationId,
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
    description: "Versioned REST contract for the independently deployed Tally web application.",
  },
  servers: [{ url: "/api/v1" }],
  paths,
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      refreshCookieAuth: { type: "apiKey", in: "cookie", name: "tally_rt" },
    },
    schemas,
    responses: {
      Error: {
        description: "API error",
        content: { "application/json": { schema: ref("ErrorEnvelope") } },
      },
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
