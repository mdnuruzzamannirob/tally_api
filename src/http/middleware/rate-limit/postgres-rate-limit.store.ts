import { createHash } from "node:crypto";
import type { Options, Store } from "express-rate-limit";
import type { PrismaClient } from "../../../generated/prisma/client.js";

/** Atomic counters shared by API replicas; keys never contain a raw IP address. */
export class PostgresRateLimitStore implements Store {
  readonly localKeys = false;
  readonly prefix: string;
  private windowMs = 0;

  constructor(
    private readonly client: PrismaClient,
    private readonly bucket: string,
  ) {
    this.prefix = `auth:${bucket}:`;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private hash(key: string): string {
    return createHash("sha256").update(key).digest("hex");
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const hash = this.hash(key);
    const [row] = await this.client.$queryRaw<Array<{ hits: number; reset_at: Date }>>`
      INSERT INTO auth_rate_limits (bucket, key_hash, hits, reset_at)
      VALUES (${this.bucket}, ${hash}, 1, NOW() + ${this.windowMs} * INTERVAL '1 millisecond')
      ON CONFLICT (bucket, key_hash) DO UPDATE SET
        hits = CASE WHEN auth_rate_limits.reset_at <= NOW() THEN 1 ELSE auth_rate_limits.hits + 1 END,
        reset_at = CASE WHEN auth_rate_limits.reset_at <= NOW()
          THEN NOW() + ${this.windowMs} * INTERVAL '1 millisecond' ELSE auth_rate_limits.reset_at END
      RETURNING hits, reset_at`;
    if (!row) throw new Error("Failed to increment auth rate limit counter.");
    return { totalHits: row.hits, resetTime: row.reset_at };
  }

  async decrement(key: string): Promise<void> {
    await this.client.$executeRaw`UPDATE auth_rate_limits SET hits = GREATEST(hits - 1, 0)
      WHERE bucket = ${this.bucket} AND key_hash = ${this.hash(key)} AND reset_at > NOW()`;
  }

  async resetKey(key: string): Promise<void> {
    await this.client.$executeRaw`DELETE FROM auth_rate_limits
      WHERE bucket = ${this.bucket} AND key_hash = ${this.hash(key)}`;
  }
}
