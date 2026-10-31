# Email and notifications

## Behavior

- Signup and resend-verification send verification emails immediately. Forgot-password sends a reset email immediately. Provider rejection returns `503 EMAIL_DELIVERY_FAILED`; verification is never bypassed.
- A previous verification/reset token stays usable if a replacement email fails. After the provider accepts a replacement, older tokens are removed. Consuming a password-reset token invalidates sibling reset tokens and revokes existing refresh sessions in the same transaction.
- Setting or changing a password also invalidates all outstanding password-recovery links.
- Interview creation, edits/removal, application status changes, password set/change/reset, and explicit social-account linking/unlinking create a persisted notification in the same transaction as the change.
- Interview reminders are created once per scheduled time during the 24 hours before the interview. A reschedule creates a new reminder. Cancelled, removed, archived or past interviews are skipped before email delivery.
- Follow-up reminders are created once per due timestamp for unarchived applications excluding rejected/withdrawn applications. Rescheduling invalidates a pending old reminder.
- In-app notifications are always available. `notificationsEnabled` controls optional email for interviews, status changes and follow-ups. Verified users receive password and social-account security emails even when optional notifications are disabled. Unverified addresses are not sent notification emails.
- The inbox returns the latest 50 notifications plus the total unread count. Read operations are scoped to the authenticated user. Mark-all-read includes older notifications.

## Delivery and retries

The API starts a non-overlapping worker every 60 seconds (including an initial run).
`NOTIFICATION_WORKER_ENABLED=false` disables it. At least one always-on API instance
must have the worker enabled. A service that sleeps cannot guarantee timely reminders;
use an always-on Render instance for scheduled alerts.

Notifications are leased in PostgreSQL with `FOR UPDATE SKIP LOCKED`; concurrent
replicas do not normally claim the same email. Crashed leases become available after
five minutes. Each run claims up to five emails and each email gets at most five job
attempts, with exponential delays. Failed jobs remain in the database for diagnosis.

Resend transport retries temporary HTTP 429/5xx and network failures up to three
times with a stable idempotency key, bounded delays and a ten-second timeout per
attempt. Resend deduplicates requests for 24 hours. This is at-least-once delivery;
a crash lasting beyond the provider's deduplication window can still cause a duplicate.
Other providers do not get ambiguous transport retries; notification jobs still retry.
SMTP has connection, greeting and socket timeouts.

`email_accepted` logs a provider message ID when supplied. Notification rows save
that ID as `provider_message_id`. `ACCEPTED` means accepted by the provider, not
confirmed delivery to the recipient. Provider failures log HTTP status and a sanitized
machine error code, without recipient addresses, action tokens or provider response text.

## Deployment checklist

1. In Resend, add a domain you own and complete its DNS verification. Use an address on that domain for `EMAIL_FROM`; production rejects `@resend.dev` test senders.
2. In Render's secret/environment settings set `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, `EMAIL_FROM`, `WEB_APP_URL=https://tallywebsite.vercel.app`, and `NOTIFICATION_WORKER_ENABLED=true`. Keep the existing database, JWT, OAuth and secure-cookie settings.
3. Run `pnpm db:generate` during build. Run `pnpm db:deploy` against the deployment database **before** starting this release. This adds `notifications` and `email_delivery_events`; do not run a database reset.
   For Docker Compose use `docker compose -f docker-compose.deploy.yml --profile migration run --rm migrate` before `docker compose -f docker-compose.deploy.yml up -d api`. The Dockerfile includes a dedicated `migration` target.
4. In Resend create a webhook for `https://tally-api-stag.onrender.com/api/v1/webhooks/resend`. Subscribe to email events such as `email.sent`, `email.delivered`, `email.bounced`, `email.failed`, `email.delivery_delayed`, `email.complained` and `email.suppressed`.
5. Set its `whsec_...` signing secret as `RESEND_WEBHOOK_SECRET` in Render and redeploy. The endpoint verifies the exact raw body, signature and a five-minute timestamp tolerance. Events are stored idempotently using the Svix event ID. Signing secrets and API keys are different credentials.
6. Deploy the frontend with the updated API contract. Existing users should enable Email notifications in Settings if they want optional emails; the default remains off.
7. Verify signup, resend, password recovery, a password change, an interview within the next 24 hours and a due follow-up. Check the notification bell and mark-read controls. Use Resend's dashboard for delivery/spam/suppression diagnosis.

A sending-only Resend key can send mail but cannot list domains. A 401 on the domains
API is not evidence that sending is broken. Domain/key scope must be checked in the
dashboard. No actual production email or deployment is performed by the test suite.

## Operational queries

```sql
SELECT id, email_status, attempts, next_attempt_at, provider_message_id
FROM notifications
WHERE email_status = 'FAILED'
ORDER BY created_at DESC;

SELECT n.id, n.email_status, e.type, e.occurred_at
FROM notifications n
LEFT JOIN email_delivery_events e ON e.message_id = n.provider_message_id
ORDER BY e.occurred_at DESC NULLS LAST
LIMIT 100;
```

Fix provider configuration before manually requeuing a failed job. Requeuing an
already accepted message after 24 hours may send a duplicate. Inbox notifications
and webhook events currently have no automatic retention policy; archive or delete
old operational records according to your retention needs.

## API

- `GET /api/v1/notifications`: `{ items, unread }` in the standard success envelope.
- `PATCH /api/v1/notifications/:id/read`: mark one owned item as read.
- `PATCH /api/v1/notifications/read-all`: mark all owned items as read.
- `POST /api/v1/webhooks/resend`: raw JSON with `svix-id`, `svix-timestamp`, `svix-signature`; uses signature authentication rather than a user JWT.

References: [Resend sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain),
[idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys),
[webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests).
