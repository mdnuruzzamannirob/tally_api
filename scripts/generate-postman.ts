import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import prettier from "prettier";

import { openApiRoutes, type OpenApiRoute } from "./openapi-routes.js";

type JsonObject = Record<string, unknown>;

const bodyExamples: Record<string, unknown> = {
  Register: { name: "Nirob Hasan", email: "{{userEmail}}", password: "{{userPassword}}" },
  Login: { email: "{{userEmail}}", password: "{{userPassword}}" },
  Email: { email: "{{userEmail}}" },
  Token: { token: "{{verificationToken}}" },
  ResetPassword: { token: "{{resetToken}}", password: "{{newPassword}}" },
  ChangePassword: {
    currentPassword: "{{userPassword}}",
    newPassword: "{{newPassword}}",
  },
  SetPassword: { newPassword: "{{userPassword}}" },
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
    tagIds: [],
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
    location: "Remote",
    notes: "Technical screening",
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

const successData: Record<string, unknown> = {
  health: { status: "ok", database: "connected", timestamp: "2026-08-11T00:00:00.000Z" },
  register: { message: "Registration successful. Please verify your email." },
  login: {
    accessToken: "eyJhbGciOiJIUzI1NiJ9.example.signature",
    user: {
      id: "cm0user123",
      name: "Nirob Hasan",
      email: "nirob@example.com",
      emailVerified: true,
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
    },
  },
};

const folderNames: Record<string, string> = {
  health: "00 - System",
  auth: "01 - Authentication",
  users: "02 - Users",
  applications: "03 - Applications",
  tags: "04 - Tags",
  notes: "05 - Notes",
  interviews: "06 - Interviews",
  dashboard: "07 - Dashboard",
  export: "08 - Export & Import",
  import: "08 - Export & Import",
};

const summaries: Record<string, string> = {
  health: "Check API health",
  register: "Register a user",
  login: "Login and save access token",
  refresh: "Refresh and save access token",
  createApplication: "Create and save an application",
  createTag: "Create and save a tag",
  createNote: "Create and save a note",
  createInterview: "Create and save an interview",
};

const titleCase = (operationId: string) =>
  operationId.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (value) => value.toUpperCase());

const pathVariable = (route: OpenApiRoute, parameter: string): string => {
  if (parameter === "tagId") return "tagId";
  if (route.path.startsWith("/applications/{id}")) return "applicationId";
  if (route.path.startsWith("/tags/{id}")) return "tagId";
  if (route.path.startsWith("/notes/{id}")) return "noteId";
  if (route.path.startsWith("/interviews/{id}")) return "interviewId";
  if (parameter === "provider") return "oauthProvider";
  return parameter;
};

const resolvedPath = (route: OpenApiRoute) =>
  (route.params ?? []).reduce(
    (path, parameter) => path.replace(`{${parameter}}`, `{{${pathVariable(route, parameter)}}}`),
    route.path,
  );

const requestAuth = (route: OpenApiRoute) =>
  route.auth === "bearer"
    ? { type: "bearer", bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }] }
    : { type: "noauth" };

const testScripts: Record<string, string[]> = {
  login: [
    "const json = pm.response.json();",
    'if (json?.data?.accessToken) pm.collectionVariables.set("accessToken", json.data.accessToken);',
  ],
  refresh: [
    "const json = pm.response.json();",
    'if (json?.data?.accessToken) pm.collectionVariables.set("accessToken", json.data.accessToken);',
  ],
  createApplication: [
    "const json = pm.response.json();",
    'if (json?.data?.application?.id) pm.collectionVariables.set("applicationId", json.data.application.id);',
  ],
  createTag: [
    "const json = pm.response.json();",
    'if (json?.data?.tag?.id) pm.collectionVariables.set("tagId", json.data.tag.id);',
  ],
  createNote: [
    "const json = pm.response.json();",
    'if (json?.data?.note?.id) pm.collectionVariables.set("noteId", json.data.note.id);',
  ],
  createInterview: [
    "const json = pm.response.json();",
    'if (json?.data?.interview?.id) pm.collectionVariables.set("interviewId", json.data.interview.id);',
  ],
  logout: ['pm.collectionVariables.unset("accessToken");'],
};

const errorBody = (code: string, message: string) =>
  JSON.stringify(
    {
      success: false,
      message,
      error: { code },
      meta: { requestId: "req_01HZXEXAMPLE" },
    },
    null,
    2,
  );

const savedResponse = (
  name: string,
  code: number,
  body: string,
  originalRequest: JsonObject,
): JsonObject => ({
  name,
  originalRequest,
  status:
    code === 200
      ? "OK"
      : code === 201
        ? "Created"
        : code === 400
          ? "Bad Request"
          : code === 401
            ? "Unauthorized"
            : code === 404
              ? "Not Found"
              : code === 409
                ? "Conflict"
                : "Too Many Requests",
  code,
  _postman_previewlanguage: "json",
  header: [{ key: "Content-Type", value: "application/json" }],
  cookie: [],
  body,
});

function buildRequest(route: OpenApiRoute): JsonObject {
  const path = resolvedPath(route);
  const query = (route.query ?? []).map((key) => ({
    key,
    value:
      key === "page" ? "1" : key === "pageSize" ? "20" : key === "includeArchived" ? "false" : "",
    disabled: !["page", "pageSize"].includes(key),
  }));
  const request: JsonObject = {
    method: route.method.toUpperCase(),
    header: [
      { key: "Accept", value: "application/json", type: "text" },
      ...(route.body ? [{ key: "Content-Type", value: "application/json", type: "text" }] : []),
      ...(route.auth === "cookie" ? [{ key: "Origin", value: "{{webAppUrl}}", type: "text" }] : []),
    ],
    auth: requestAuth(route),
    url: {
      raw: `{{baseUrl}}${path}`,
      host: ["{{baseUrl}}"],
      path: path.split("/").filter(Boolean),
      ...(query.length ? { query } : {}),
    },
    description: `${summaries[route.operationId] ?? titleCase(route.operationId)}. See {{openApiUrl}} for the authoritative schema.`,
    ...(route.body
      ? {
          body: {
            mode: "raw",
            raw: JSON.stringify(bodyExamples[route.body] ?? {}, null, 2),
            options: { raw: { language: "json" } },
          },
        }
      : {}),
  };
  return request;
}

function buildItem(route: OpenApiRoute): JsonObject {
  const request = buildRequest(route);
  const successCode =
    route.response === "created" ? 201 : route.response === "redirect" ? 302 : 200;
  const responses: JsonObject[] = [];

  if (route.response === "redirect") {
    responses.push({
      name: "302 - Redirect",
      originalRequest: request,
      status: "Found",
      code: 302,
      _postman_previewlanguage: "text",
      header: [
        {
          key: "Location",
          value: "https://provider.example.com/oauth/authorize?state=example",
        },
      ],
      cookie: [],
      body: "",
    });
  } else if (route.response === "file") {
    responses.push({
      name: "200 - Download",
      originalRequest: request,
      status: "OK",
      code: 200,
      _postman_previewlanguage: route.operationId === "exportCsv" ? "text" : "json",
      header: [
        {
          key: "Content-Type",
          value: route.operationId === "exportCsv" ? "text/csv" : "application/json",
        },
        {
          key: "Content-Disposition",
          value:
            route.operationId === "exportCsv"
              ? 'attachment; filename="tally-applications-2026-08-11.csv"'
              : 'attachment; filename="tally-backup-2026-08-11.json"',
        },
      ],
      cookie: [],
      body:
        route.operationId === "exportCsv"
          ? "company,role,status\r\nOpenAI,Software Engineer,APPLIED"
          : JSON.stringify(
              {
                version: 1,
                exportedAt: "2026-08-11T00:00:00.000Z",
                profile: {},
                tags: [],
                applications: [],
              },
              null,
              2,
            ),
    });
    responses.push(
      savedResponse(
        "401 - Unauthorized",
        401,
        errorBody("UNAUTHORIZED", "Authentication is required."),
        request,
      ),
    );
  } else {
    responses.push(
      savedResponse(
        `${successCode} - Success`,
        successCode,
        JSON.stringify(
          {
            success: true,
            message:
              successCode === 201
                ? "Resource created successfully."
                : "Request completed successfully.",
            data: successData[route.operationId] ?? { message: "Request completed." },
            meta: { requestId: "req_01HZXEXAMPLE" },
          },
          null,
          2,
        ),
        request,
      ),
    );
    responses.push(
      savedResponse(
        "400 - Bad Request",
        400,
        errorBody("BAD_REQUEST", "The request is invalid."),
        request,
      ),
    );
    if (route.auth) {
      responses.push(
        savedResponse(
          "401 - Unauthorized",
          401,
          errorBody("UNAUTHORIZED", "Authentication is required."),
          request,
        ),
      );
    }
    if (route.params?.length) {
      responses.push(
        savedResponse(
          "404 - Not Found",
          404,
          errorBody("NOT_FOUND", "The requested resource was not found."),
          request,
        ),
      );
    }
    if (route.method !== "get") {
      responses.push(
        savedResponse(
          "409 - Conflict",
          409,
          errorBody("CONFLICT", "The request conflicts with existing data."),
          request,
        ),
      );
    }
    responses.push(
      savedResponse(
        "429 - Rate Limited",
        429,
        errorBody("RATE_LIMITED", "Too many requests."),
        request,
      ),
    );
  }

  return {
    name: summaries[route.operationId] ?? titleCase(route.operationId),
    request,
    ...(route.response === "redirect"
      ? { protocolProfileBehavior: { followRedirects: false } }
      : {}),
    ...(testScripts[route.operationId]
      ? {
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  'pm.test("Expected successful status", () => pm.expect(pm.response.code).to.be.oneOf([200, 201, 302]));',
                  ...testScripts[route.operationId]!,
                ],
              },
            },
          ],
        }
      : {}),
    response: responses,
  };
}

const folders = new Map<string, JsonObject[]>();
for (const route of openApiRoutes) {
  const segment = route.path.split("/").filter(Boolean)[0] ?? "health";
  const folder = folderNames[segment] ?? "09 - Other";
  const items = folders.get(folder) ?? [];
  items.push(buildItem(route));
  folders.set(folder, items);
}

const collection = {
  info: {
    _postman_id: "98b1f9d5-43cb-4a66-86b9-bc490090b612",
    name: "Tally API - Complete Collection",
    description:
      "Import-ready Tally API collection. Login automatically stores the access token; create operations store resource IDs. Postman manages the tally_rt refresh cookie through its cookie jar. Run requests in numbered folder order for the smoothest workflow.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  event: [
    {
      listen: "prerequest",
      script: {
        type: "text/javascript",
        exec: [
          'pm.request.headers.upsert({ key: "X-Request-ID", value: pm.variables.replaceIn("postman-{{$guid}}") });',
        ],
      },
    },
  ],
  variable: [
    { key: "baseUrl", value: "http://localhost:4000/api/v1", type: "string" },
    { key: "webAppUrl", value: "http://localhost:3000", type: "string" },
    { key: "openApiUrl", value: "http://localhost:4000/api/v1/openapi.json", type: "string" },
    { key: "accessToken", value: "", type: "string" },
    { key: "userEmail", value: "nirob@example.com", type: "string" },
    { key: "userPassword", value: "StrongPass123!", type: "string" },
    { key: "newPassword", value: "NewStrongPass123!", type: "string" },
    { key: "verificationToken", value: "", type: "string" },
    { key: "resetToken", value: "", type: "string" },
    { key: "applicationId", value: "", type: "string" },
    { key: "tagId", value: "", type: "string" },
    { key: "noteId", value: "", type: "string" },
    { key: "interviewId", value: "", type: "string" },
    { key: "oauthProvider", value: "google", type: "string" },
  ],
  item: [...folders.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, item]) => ({ name, item })),
};

const outputPath = fileURLToPath(new URL("../contracts/tally.postman.json", import.meta.url));
await writeFile(
  outputPath,
  await prettier.format(JSON.stringify(collection), {
    parser: "json",
    printWidth: 100,
    trailingComma: "all",
  }),
);
console.info(`Generated Postman collection with ${openApiRoutes.length} requests.`);
