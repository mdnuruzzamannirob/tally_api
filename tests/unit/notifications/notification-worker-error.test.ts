import { describe, expect, it } from "vitest";
import { notificationWorkerError } from "../../../src/modules/notifications/notification-worker-error.js";

describe("notification worker diagnostics", () => {
  it.each([
    { code: "P2021" },
    { code: "P2022" },
    { code: "P2010", meta: { code: "42P01" } },
    { code: "P2010", meta: { code: "42703" } },
  ])("identifies missing schema without logging SQL or secrets %#", (cause) => {
    const result = notificationWorkerError({
      ...cause,
      message: "private database credentials",
      meta: { ...("meta" in cause ? cause.meta : {}), query: "private SQL" },
    });
    expect(result.errorCode).toBe(cause.code);
    expect(result.action).toContain("npm run db:setup");
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("distinguishes a connection failure from unrelated Prisma failures", () => {
    expect(notificationWorkerError({ code: "P1001" }).action).toContain("PostgreSQL");
    expect(notificationWorkerError({ code: "P2002" })).not.toHaveProperty("action");
    expect(notificationWorkerError(null)).toEqual({
      event: "notification_worker_failed",
      errorName: "UnknownError",
    });
  });
});
