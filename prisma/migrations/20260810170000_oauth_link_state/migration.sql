CREATE TYPE "OAuthIntent" AS ENUM ('LOGIN', 'LINK');

ALTER TABLE "oauth_states"
  ADD COLUMN "intent" "OAuthIntent" NOT NULL DEFAULT 'LOGIN',
  ADD COLUMN "user_id" TEXT;

CREATE INDEX "oauth_states_user_id_idx" ON "oauth_states"("user_id");

ALTER TABLE "oauth_states"
  ADD CONSTRAINT "oauth_states_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
