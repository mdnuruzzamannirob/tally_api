import { describe, expect, it } from "vitest";
import { notificationWorkerError } from "../../../src/modules/notifications/notification-worker-error.js";

describe("notification worker diagnostics", () => {
  it.each([
    ["Tenant or user not found", "provider-tenant-not-found"],
    ["password authentication failed", "authentication-failed"],
    ["endpoint has been disabled", "provider-paused-or-disabled"],
    ["compute quota exceeded", "provider-limit"],
    ["self-signed certificate in certificate chain", "tls-connection"],
    ["connection timeout", "connection-timeout"],
  ])(
    "classifies an unmapped driver failure without exposing its message: %s",
    (message, category) => {
      const result = notificationWorkerError({
        code: "P2039",
        message: "PRIVATE_CONNECTION",
        meta: {
          driverAdapterError: {
            cause: { originalCode: "XX000", originalMessage: `${message}: PRIVATE_CREDENTIALS` },
          },
        },
      });
      expect(result).toMatchObject({
        errorCode: "P2039",
        driverFailure: category,
        driverCode: "XX000",
      });
      expect(JSON.stringify(result)).not.toContain("PRIVATE_");
    },
  );
  it("bounds cyclic metadata and excludes unknown driver codes and messages", () => {
    const error: Record<string, unknown> = {
      code: "P2039",
      message: "PRIVATE_MESSAGE",
      originalCode: "PRIVATE_CODE",
    };
    error.cause = error;
    const result = notificationWorkerError(error);
    expect(result).toMatchObject({ driverFailure: "unclassified-driver-error" });
    expect(result).not.toHaveProperty("driverCode");
    expect(JSON.stringify(result)).not.toContain("PRIVATE_");
  });
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
