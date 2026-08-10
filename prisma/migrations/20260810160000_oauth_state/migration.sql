CREATE TABLE "oauth_states" (
    "id" TEXT NOT NULL,
    "provider" "OauthProvider" NOT NULL,
    "state_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oauth_states_state_hash_key" ON "oauth_states"("state_hash");
CREATE INDEX "oauth_states_expires_at_idx" ON "oauth_states"("expires_at");
