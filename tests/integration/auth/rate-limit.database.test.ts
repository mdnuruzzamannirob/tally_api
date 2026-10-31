import { randomUUID } from "node:crypto";
import express from "express";
import { rateLimit } from "express-rate-limit";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresRateLimitStore } from "../../../src/http/middleware/rate-limit/postgres-rate-limit.store.js";
import { createTestPrismaClient } from "../../helpers/db.js";

const enabled = Boolean(process.env.TEST_DATABASE_URL);
describe.skipIf(!enabled)("shared auth rate limiting", () => {
  let client: ReturnType<typeof createTestPrismaClient>;
  const bucket = `test-${randomUUID()}`;
  beforeAll(async () => {
    client = createTestPrismaClient();
    await client.$connect();
  });
  afterAll(async () => {
    await client.$executeRaw`DELETE FROM auth_rate_limits WHERE bucket = ${bucket} OR bucket = ${bucket + "-other"}`;
    await client.$disconnect();
  });
  it("shares atomic counts between server instances and isolates other actions", async () => {
    const app = express();
    const first = rateLimit({
      windowMs: 60_000,
      limit: 5,
      store: new PostgresRateLimitStore(client, bucket),
    });
    const second = rateLimit({
      windowMs: 60_000,
      limit: 5,
      store: new PostgresRateLimitStore(client, bucket),
    });
    const other = rateLimit({
      windowMs: 60_000,
      limit: 5,
      store: new PostgresRateLimitStore(client, bucket + "-other"),
    });
    app.get("/first", first, (_req, res) => res.sendStatus(204));
    app.get("/second", second, (_req, res) => res.sendStatus(204));
    app.get("/other", other, (_req, res) => res.sendStatus(204));
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, index) => request(app).get(index % 2 ? "/first" : "/second")),
    );
    expect(results.map((response) => response.status)).toEqual([204, 204, 204, 204, 204]);
    const rejected = await request(app).get("/first");
    expect(rejected.status).toBe(429);
    expect(Number(rejected.headers["retry-after"])).toBeGreaterThan(0);
    await request(app).get("/other").expect(204);
    const rows = await client.$queryRaw<
      Array<{ key_hash: string; hits: number }>
    >`SELECT key_hash, hits FROM auth_rate_limits WHERE bucket = ${bucket}`;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.key_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(rows[0]!.hits).toBe(6);
    await client.$executeRaw`UPDATE auth_rate_limits SET reset_at = NOW() - INTERVAL '1 second' WHERE bucket = ${bucket}`;
    await request(app).get("/second").expect(204);
  });
});
