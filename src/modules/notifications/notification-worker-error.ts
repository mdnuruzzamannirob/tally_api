function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

export function notificationWorkerError(error: unknown) {
  const value = object(error);
  const meta = object(value?.meta);
  const code =
    typeof value?.code === "string" && /^[A-Z0-9_]{1,30}$/.test(value.code)
      ? value.code
      : undefined;
  const databaseCode =
    typeof meta?.code === "string" && /^[A-Z0-9]{5}$/.test(meta.code) ? meta.code : undefined;
  const schemaMissing =
    code === "P2021" ||
    code === "P2022" ||
    (code === "P2010" && (databaseCode === "42P01" || databaseCode === "42703"));
  const connectionFailed = code === "P1001" || code === "P1002" || code === "P1017";
  return {
    event: "notification_worker_failed",
    errorName: error instanceof Error ? error.name : "UnknownError",
    ...(code ? { errorCode: code } : {}),
    ...(databaseCode ? { databaseCode } : {}),
    ...(schemaMissing
      ? {
          action:
            "Database schema is out of date. Run npm run db:setup in tally_api against the intended database, then restart the API.",
        }
      : {}),
    ...(connectionFailed
      ? {
          action:
            "Check that PostgreSQL is running and DATABASE_URL points to the intended reachable database.",
        }
      : {}),
  };
}
