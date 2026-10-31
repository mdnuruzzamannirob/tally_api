# Auth, email and notifications review

Reviewed 31 October 2026. Changes are local; no deployment or live email send was performed.

## Findings and fixes

| Finding                                                                                    | Result                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login, registration, verification, refresh, logout and reset shared one 10-request limiter | Independent action buckets, created per router. Successful logins do not consume the failed-login budget. Refresh has its own larger allowance.                        |
| Password change/set lacked targeted abuse protection                                       | Both authenticated password operations now have a dedicated shared password-operation limit.                                                                           |
| CORS allowed local frontend ports that cookie refresh rejected                             | One origin allowlist now governs both. Production accepts only the configured frontend origin; development accepts the supported localhost ports.                      |
| Verification checked a token before an unconditional user update                           | Token consumption and expiry are rechecked transactionally while locking the user. Concurrent requests produce one success and one invalid-token response.             |
| Frontend counted password characters while bcrypt/API limits bytes                         | Frontend now enforces the same 72-byte limit, including non-ASCII passwords. Password guidance matches the actual policy.                                              |
| Login displayed a nonfunctional 30-day checkbox                                            | Removed the unsupported promise; session duration continues to follow the configured server lifetime.                                                                  |
| Reset silently ignored mismatched passwords and gave an unclear missing-link error         | Explicit validation feedback and a link to request another reset email.                                                                                                |
| Login redirect accepted protocol-relative URLs                                             | Parse and normalize redirects, allow only the current origin, and preserve internal query parameters and fragments.                                                    |
| Auth field labels were not associated with their inputs                                    | Added explicit label/input associations across login, registration, recovery and verification.                                                                         |
| Notification inbox used a modal                                                            | Replaced with a bell-anchored popover, bounded scrolling, responsive width, keyboard dismissal and focus return.                                                       |
| Notifications requested focus-aware polling without registering browser listeners          | Store provider now registers and cleans up RTK Query listeners.                                                                                                        |
| Transactional email design and notification presentation needed refinement                 | Shared restrained email layout with a text fallback, escaped content, clear CTA and expiry information; compact notification rows, unread dots and inline read action. |

## Coverage checked

- Registration normalizes email and hashes passwords. A failed initial verification delivery can be recovered by registering again with the same password; it does not overwrite an existing account.
- Replacement verification/reset links preserve the earlier delivered link when replacement delivery fails. Only older tokens are pruned after delivery succeeds.
- Login requires a verified email. Refresh tokens are stored hashed, rotated, preserve their absolute expiry and revoke sessions on replay. Logout clears the cookie.
- Password reset tokens are single-use. Reset revokes refresh sessions; password change preserves only the current refresh session. Password actions create security notifications.
- OAuth state, connected-account rules and callback flows are covered by existing database tests.
- Notification reads are scoped to the authenticated owner. The worker uses database leases, relevance checks, opt-in rules and bounded retries. Provider failures do not expose credentials or email bodies in error responses.
- Development and production environment validation passes. Brevo is selected and credentials are present; configuration validation does not prove provider authorization, sender approval or inbox delivery.

## Validation

- API unit/HTTP suite: 80 tests pass.
- Database integration suite: 52 tests pass, including concurrent verification and shared rate-limit counters.
- Frontend unit suite: 35 tests pass.
- Chromium browser suite: 7 tests pass, including auth labels and desktop/mobile notification popover bounds, mark-as-read, Escape and focus return.
- API and frontend production builds, type checks and lint pass.
- Verification, reset and notification email previews rendered in Chromium; mobile and desktop layout inspected. Actual email clients may render fonts and spacing differently.

## Operational limits

Production authentication rate limits use PostgreSQL counters shared across API replicas. Apply the `20261031120000_auth_rate_limits` migration before starting the new API version; the production runtime requires that table and database availability. Development and tests use in-memory counters by default. The separate global API limiter remains in memory per process. Expired auth counters are cleaned up periodically by the API server.

Live mail provider acceptance and inbox placement were not tested. Existing access JWTs can remain valid until their short expiry after a password reset; refresh sessions are revoked immediately. The worker polls every minute, so sleeping hosting instances can delay reminders. These behaviors are separate from the corrected endpoint and interface defects.
