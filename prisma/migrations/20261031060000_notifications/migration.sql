CREATE TABLE "notifications" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "event_key" TEXT NOT NULL UNIQUE,
 "title" TEXT NOT NULL,
 "body" TEXT NOT NULL,
 "href" TEXT NOT NULL,
 "required" BOOLEAN NOT NULL DEFAULT false,
 "read_at" TIMESTAMPTZ(3),
 "email_status" TEXT NOT NULL DEFAULT 'PENDING',
 "provider_message_id" TEXT,
 "attempts" INTEGER NOT NULL DEFAULT 0,
 "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
CREATE INDEX "notifications_email_status_next_attempt_at_idx" ON "notifications"("email_status", "next_attempt_at");
CREATE TABLE "email_delivery_events" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "message_id" TEXT NOT NULL,
 "type" TEXT NOT NULL,
 "occurred_at" TIMESTAMPTZ(3) NOT NULL,
 "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "email_delivery_events_message_id_occurred_at_idx" ON "email_delivery_events"("message_id", "occurred_at");
