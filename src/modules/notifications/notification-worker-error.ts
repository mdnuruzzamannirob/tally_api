function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Classify driver failures without returning driver messages or connection details. */
function driverDiagnostics(error: unknown) {
  const pending: unknown[] = [error];
  const seen = new Set<object>();
  const messages: string[] = [];
  const codes: string[] = [];
  while (pending.length && seen.size < 32) {
    const item = object(pending.shift());
    if (!item || seen.has(item)) continue;
    seen.add(item);
    for (const key of ["message", "originalMessage", "reason"]) {
      if (typeof item[key] === "string") messages.push(item[key].slice(0, 8000));
    }
    for (const key of ["code", "originalCode"]) {
      if (typeof item[key] === "string") codes.push(item[key]);
    }
    for (const key of ["meta", "cause", "driverAdapterError", "originalError", "error"]) {
      if (object(item[key])) pending.push(item[key]);
    }
  }
  const text = messages.join("\n");
  const categories: [RegExp, string][] = [
    [/tenant or user not found/i, "provider-tenant-not-found"],
    [
      /password authentication failed|invalid password|authentication failed/i,
      "authentication-failed",
    ],
    [
      /endpoint.*disabled|project.*(?:paused|suspend)|database.*(?:paused|suspend)/i,
      "provider-paused-or-disabled",
    ],
    [/quota|compute.*limit|exceeded.*(?:usage|limit)|credits?.*exhaust/i, "provider-limit"],
    [/database .* does not exist/i, "database-not-found"],
    [/certificate|self.signed|SSL|TLS/i, "tls-connection"],
    [/timed? ?out|timeout/i, "connection-timeout"],
  ];
  const allowedCodes = new Set([
    "XX000",
    "28P01",
    "28000",
    "3D000",
    "57P01",
    "57P02",
    "57P03",
    "53300",
    "53400",
    "08000",
    "08001",
    "08003",
    "08004",
    "08006",
    "08007",
    "08P01",
    "42P01",
    "42703",
  ]);
  const driverCode = codes.find((code) => allowedCodes.has(code));
  return {
    driverFailure:
      categories.find(([pattern]) => pattern.test(text))?.[1] ?? "unclassified-driver-error",
    ...(driverCode ? { driverCode } : {}),
  };
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
    ...(code === "P2039" ? driverDiagnostics(error) : {}),
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
