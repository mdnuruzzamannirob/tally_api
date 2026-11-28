import { mkdir, writeFile } from "node:fs/promises";
import { cpus, totalmem, platform } from "node:os";
import { performance } from "node:perf_hooks";
import { prisma } from "../src/core/database/prisma.js";
import { createAccessToken } from "../src/core/security/jwt.js";
import { hashPassword } from "../src/core/security/password.js";

const database = new URL(process.env.DATABASE_URL!);
if (
  process.env.NODE_ENV !== "test" ||
  process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL ||
  !["localhost", "127.0.0.1"].includes(database.hostname) ||
  !database.pathname.startsWith("/tally_phase_")
) {
  throw new Error("Measurements require the isolated local phase-verification database.");
}
const output = process.env.TALLY_METRICS_OUTPUT;
if (!output) throw new Error("TALLY_METRICS_OUTPUT is required.");
await mkdir(output, { recursive: true });
const statuses = [
  "WISHLIST",
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
] as const;
const user = await prisma.user.create({
  data: {
    email: "benchmark-owner@example.test",
    passwordHash: await hashPassword("Benchmark-test-password-123!"),
    emailVerified: true,
    emailVerifiedAt: new Date(),
    timeZone: "Asia/Dhaka",
  },
});
const other = await prisma.user.create({ data: { email: "benchmark-other@example.test" } });
const now = new Date();
for (const owner of [user, other]) {
  const count = owner.id === user.id ? 5_000 : 2_500;
  for (let start = 0; start < count; start += 500) {
    await prisma.application.createMany({
      data: Array.from({ length: Math.min(500, count - start) }, (_, offset) => {
        const n = start + offset;
        return {
          id: `benchmark-${owner.id}-${n}`,
          userId: owner.id,
          company: n % 4 === 0 ? `Acme ${n}` : `Company ${n}`,
          role: n % 2 ? "Engineer" : "Designer",
          status: statuses[n % statuses.length]!,
          location: n % 3 ? "Dhaka" : "Remote",
          archivedAt: n % 10 === 9 ? now : null,
          nextFollowUpAt: n % 5 === 0 ? new Date(now.getTime() + ((n % 7) - 3) * 86_400_000) : null,
          createdAt: new Date(now.getTime() - n * 3_600_000),
          updatedAt: new Date(now.getTime() - n * 60_000),
        };
      }),
    });
  }
}
for (let start = 0; start < 5_000; start += 500) {
  const indices = Array.from({ length: 500 }, (_, offset) => start + offset);
  await prisma.note.createMany({
    data: indices
      .filter((n) => n % 10 === 0)
      .map((n) => ({
        applicationId: `benchmark-${user.id}-${n}`,
        content: `Prepared interview notes ${n}`,
      })),
  });
  await prisma.interview.createMany({
    data: indices
      .filter((n) => n % 10 === 0)
      .map((n) => ({
        applicationId: `benchmark-${user.id}-${n}`,
        type: "TECHNICAL" as const,
        scheduledAt: new Date(now.getTime() + ((n % 30) - 10) * 86_400_000),
        status: n % 3 ? ("SCHEDULED" as const) : ("COMPLETED" as const),
      })),
  });
  await prisma.statusHistory.createMany({
    data: indices
      .filter((n) => statuses[n % 7] !== "WISHLIST")
      .map((n) => ({
        applicationId: `benchmark-${user.id}-${n}`,
        fromStatus: "WISHLIST" as const,
        toStatus: statuses[n % 7]!,
      })),
  });
}
await prisma.$executeRawUnsafe("ANALYZE applications");
await prisma.$executeRawUnsafe("ANALYZE notes");
await prisma.$executeRawUnsafe("ANALYZE interviews");
let queryCounters = true;
try {
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS pg_stat_statements");
} catch {
  queryCounters = false;
}

const plans: Record<string, unknown> = {};
plans.list = await prisma.$queryRawUnsafe(
  "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id,company,role,updated_at FROM applications WHERE user_id=$1 AND archived_at IS NULL ORDER BY updated_at DESC,id ASC LIMIT 20",
  user.id,
);
plans.search = await prisma.$queryRawUnsafe(
  "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id FROM applications WHERE user_id=$1 AND archived_at IS NULL AND (company ILIKE $2 OR role ILIKE $2 OR location ILIKE $2 OR EXISTS (SELECT 1 FROM notes WHERE notes.application_id=applications.id AND content ILIKE $2)) ORDER BY updated_at DESC,id ASC LIMIT 20",
  user.id,
  "%Acme%",
);
await writeFile(
  `${output}/query-plans.json`,
  JSON.stringify(
    {
      note: "Representative SQL shapes; request SQL counts are measured separately when pg_stat_statements is available.",
      plans,
    },
    null,
    2,
  ),
);
const authorization = `Bearer ${createAccessToken({ sub: user.id, emailVerified: true })}`;
const routes = [
  "/applications?page=1&pageSize=20",
  "/applications?search=Acme&pageSize=20",
  "/dashboard",
  "/interviews?range=upcoming&pageSize=20",
];
const results = [];
const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
for (const route of routes) {
  for (let warm = 0; warm < 3; warm++)
    await (
      await fetch(`${process.env.API_BASE_URL}/api/v1${route}`, { headers: { authorization } })
    ).arrayBuffer();
  if (queryCounters) await prisma.$queryRawUnsafe("SELECT pg_stat_statements_reset()::text");
  const samples: number[] = [];
  const statusCounts: Record<string, number> = {};
  const tick = performance.now();
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      for (let i = 0; i < 12; i++) {
        const start = performance.now();
        try {
          const response = await fetch(`${process.env.API_BASE_URL}/api/v1${route}`, {
            headers: { authorization },
          });
          await response.arrayBuffer();
          statusCounts[response.status] = (statusCounts[response.status] ?? 0) + 1;
        } catch {
          statusCounts.network = (statusCounts.network ?? 0) + 1;
        }
        samples.push(performance.now() - start);
        await sleep(Math.max(0, 500 - (performance.now() - start)));
      }
    }),
  );
  const seconds = (performance.now() - tick) / 1000;
  let sqlCalls = null;
  if (queryCounters) {
    const rows = await prisma.$queryRawUnsafe<Array<{ calls: bigint }>>(
      "SELECT COALESCE(SUM(calls),0)::bigint AS calls FROM pg_stat_statements WHERE dbid=(SELECT oid FROM pg_database WHERE datname=current_database()) AND query NOT ILIKE '%pg_stat_statements%'",
    );
    sqlCalls = Number(rows[0]!.calls);
  }
  samples.sort((a, b) => a - b);
  const errors = Object.entries(statusCounts)
    .filter(([status]) => status !== "200")
    .reduce((sum, [, count]) => sum + count, 0);
  results.push({
    route,
    requests: samples.length,
    seconds,
    concurrency: 3,
    pacing_ms_per_lane: 500,
    p50_ms: samples[Math.ceil(samples.length * 0.5) - 1],
    p95_ms: samples[Math.ceil(samples.length * 0.95) - 1],
    throughput_rps: samples.length / seconds,
    error_rate: errors / samples.length,
    statusCounts,
    sql_calls: sqlCalls,
    sql_calls_per_request: sqlCalls === null ? null : sqlCalls / samples.length,
  });
}
await writeFile(
  `${output}/api-benchmark.json`,
  JSON.stringify(
    {
      measured_at: new Date().toISOString(),
      context: {
        node: process.version,
        platform: platform(),
        cpu: cpus()[0]?.model,
        logical_cpus: cpus().length,
        memory_bytes: totalmem(),
        runtime_profile: process.env.NODE_ENV,
        dataset: {
          owner_applications: 5000,
          other_owner_applications: 2500,
          notes: 500,
          interviews: 500,
          archived_ratio: 0.1,
          status_distribution: "round-robin across seven statuses",
        },
        warmup_requests_per_route: 3,
        queryCounters,
        budget: { p95_ms: 250, error_rate: 0 },
        interpretation:
          "Paced local synthetic workload, not maximum capacity, production latency, or a before/after improvement claim.",
      },
      results,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(results));
await prisma.$disconnect();
