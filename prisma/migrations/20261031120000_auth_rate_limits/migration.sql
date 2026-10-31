CREATE TABLE "auth_rate_limits" (
  "bucket" TEXT NOT NULL,
  "key_hash" TEXT NOT NULL,
  "hits" INTEGER NOT NULL,
  "reset_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("bucket", "key_hash")
);
CREATE INDEX "auth_rate_limits_reset_at_idx" ON "auth_rate_limits"("reset_at");
