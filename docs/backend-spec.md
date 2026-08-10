# Backend Specification

## Job Application Tracker

**Version:** 1.0
**Status:** Final for MVP
**Related Documents:**

- Product Requirements Document v1.1
- UI/UX Specification v1.1
- Frontend Specification v1.0
  **Primary Stack:** Express, TypeScript, PostgreSQL, Prisma, JWT, OAuth

---

## 1. Purpose and Scope

This document defines the backend architecture and implementation requirements for Job Application Tracker.

It covers:

- Backend technology stack
- API architecture
- Folder structure
- Authentication and authorization
- Email verification
- OAuth login
- Password recovery and management
- REST API design
- Validation
- Error handling
- Security
- Email delivery
- Testing
- Environment configuration
- Runtime behavior

The backend will be a separate Express TypeScript REST API and will serve the Next.js frontend.

---

## 2. Technology Stack

| Concern             | Choice                                          |
| ------------------- | ----------------------------------------------- |
| Runtime             | Node.js LTS                                     |
| Framework           | Express                                         |
| Language            | TypeScript                                      |
| ORM                 | Prisma 7+ with `@prisma/adapter-pg`             |
| Database            | PostgreSQL                                      |
| Validation          | Zod                                             |
| Authentication      | JWT access token + refresh token rotation       |
| Password hashing    | bcrypt                                          |
| OAuth               | Google and GitHub                               |
| Email provider      | Resend, SendGrid, Mailgun, or SMTP adapter      |
| Logger              | pino / pino-http                                |
| Security middleware | helmet, cors, cookie-parser, express-rate-limit |
| Compression         | compression                                     |
| Testing             | Vitest + Supertest                              |
| Process manager     | Node.js                                         |
| Dev runner          | tsx or ts-node-dev                              |
| API contract        | OpenAPI 3.1 artifact + Swagger UI               |

---

## 3. Architectural Style

The backend will use a **modular layered architecture**.

```txt
Routes
  -> Middleware
    -> Controllers
      -> Services
        -> Repositories
          -> Prisma
            -> PostgreSQL
```

---

## 4. Architecture Principles

1. Controllers should be thin.
2. Business logic should live in services.
3. Database access should live in repositories.
4. Routes should only map HTTP endpoints to controllers.
5. Middleware should handle cross-cutting concerns.
6. All input must be validated.
7. All protected resources must enforce ownership.
8. Secrets must come from environment variables.
9. Errors must be handled centrally.
10. Services should be testable without HTTP.

---

## 5. Backend Folder Structure

Recommended structure:

```txt
api/
├── src/
│   ├── server.ts
│   ├── app.ts
│   ├── config/
│   │   ├── env.ts
│   │   ├── cors.ts
│   │   ├── cookie.ts
│   │   └── constants.ts
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── logger.ts
│   │   ├── api-error.ts
│   │   ├── async-handler.ts
│   │   ├── pagination.ts
│   │   ├── crypto.ts
│   │   └── jwt.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── verified.middleware.ts
│   │   ├── validation.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── not-found.middleware.ts
│   │   ├── rate-limit.middleware.ts
│   │   ├── request-id.middleware.ts
│   │   ├── request-logger.middleware.ts
│   │   └── origin-check.middleware.ts
│   ├── email/
│   │   ├── email.service.ts
│   │   ├── email.provider.ts
│   │   └── templates/
│   │       ├── verification.email.ts
│   │       └── password-reset.email.ts
│   ├── oauth/
│   │   ├── oauth.types.ts
│   │   ├── google.oauth.ts
│   │   └── github.oauth.ts
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── applications/
│   │   ├── tags/
│   │   ├── notes/
│   │   ├── interviews/
│   │   ├── dashboard/
│   │   ├── export-import/
│   │   └── health/
│   ├── routes/
│   │   └── index.ts
│   ├── types/
│   │   ├── express.d.ts
│   │   └── common.types.ts
│   ├── utils/
│   │   ├── date.ts
│   │   ├── timezone.ts
│   │   ├── normalize.ts
│   │   └── csv.ts
│   └── generated/
│       └── prisma/
├── prisma/
│   ├── schema/
│   │   ├── base.prisma
│   │   ├── enums/
│   │   └── models/
│   ├── migrations/
│   └── seed.ts
├── contracts/
│   └── openapi.json              # versioned public API contract artifact
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── helpers/
│   └── setup.ts
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── eslint.config.js
├── package.json
├── prisma.config.ts
└── tsconfig.json
```

---

## 6. Module Structure

Each feature module should follow a consistent structure.

Example:

```txt
modules/applications/
├── application.routes.ts
├── application.controller.ts
├── application.service.ts
├── application.repository.ts
├── application.validators.ts
├── application.types.ts
└── application.constants.ts
```

Use this full pattern for every applicable feature. Small read-only modules may
omit files they do not need, but must still keep their constants, types, and
HTTP responsibilities inside the feature boundary.

---

## 7. Request Pipeline

Request flow:

```txt
Request
  -> Request ID
  -> Request logger
  -> helmet
  -> CORS
  -> JSON body parser
  -> Cookie parser
  -> Compression
  -> Route
  -> Rate limit where applicable
  -> Authentication middleware
  -> Verification middleware
  -> Validation middleware
  -> Controller
  -> Service
  -> Repository
  -> Prisma
  -> Database
  -> Response
```

Error flow:

```txt
Error
  -> Central error middleware
  -> Structured JSON error response
  -> Error logged
```

---

## 8. App and Server Separation

The Express app and HTTP server must be separated.

### `app.ts`

Responsible for:

- Creating Express app
- Registering middleware
- Registering routes
- Registering error handlers

### `server.ts`

Responsible for:

- Starting HTTP server
- Handling graceful shutdown
- Closing database connection
- Handling process signals

Graceful shutdown events:

```txt
SIGINT
SIGTERM
```

---

## 9. API Conventions

## 9.1 API Prefix

All API routes must be prefixed with:

```txt
/api/v1
```

---

## 9.2 OpenAPI and Swagger

The API contract is an OpenAPI 3.1 document at `contracts/openapi.json`. It is
the release artifact shared between the independent repositories; it is not a
workspace package or an import of API source types.

- `GET /api/v1/openapi.json` serves the exact released artifact.
- `GET /api/v1/docs` serves Swagger UI using that same document.
- Every versioned endpoint, request schema, success/error envelope, security
  scheme, raw export exception, and OAuth redirect exception is represented in
  the document.
- API CI validates the document and runs contract tests against the running
  API. Web CI pins the released artifact and validates its endpoint types
  before deployment.

Swagger UI is documentation only; authentication and authorization are always
enforced by the API routes themselves.

## 9.3 Response Envelope

All successful responses:

```json
{
  "success": true,
  "message": "Applications retrieved successfully.",
  "data": {},
  "meta": {
    "requestId": "request_id",
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

`data` is the direct endpoint payload. A single-resource endpoint returns an
object; a collection endpoint returns an array directly (for example,
`"data": []`). Do not wrap collections in an `items` field. Pagination and
collection metadata belong only in the optional top-level `meta` object.

Exceptions:

- `GET /export/json` returns a raw downloadable `application/json` backup.
- `GET /export/csv` returns a raw downloadable `text/csv` file.
- OAuth start/callback endpoints return redirects rather than JSON envelopes.

All error responses:

```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": {
      "field": ["Error message"]
    }
  },
  "meta": {
    "requestId": "request_id"
  }
}
```

`details` is optional. Validation errors use a field-to-messages object; other
error types omit it unless they have a documented structured shape. Every JSON
response includes a human-safe top-level `message`; error responses include the
non-sensitive request ID in `meta` for support correlation.

Later endpoint examples may show only their endpoint-specific `data` fragment;
the envelope in this section is authoritative and its `message` and `meta`
fields must be present whenever applicable.

---

## 9.4 Standard Error Codes

| HTTP Status | Code                       | Usage                            |
| ----------- | -------------------------- | -------------------------------- |
| 400         | `VALIDATION_ERROR`         | Invalid input                    |
| 400         | `BAD_REQUEST`              | Generic bad request              |
| 400         | `INVALID_OR_EXPIRED_TOKEN` | Verification/reset token failure |
| 401         | `UNAUTHORIZED`             | Missing/invalid authentication   |
| 401         | `INVALID_CREDENTIALS`      | Login failed                     |
| 401         | `TOKEN_EXPIRED`            | Access token expired             |
| 403         | `FORBIDDEN`                | Authenticated but not allowed    |
| 403         | `EMAIL_NOT_VERIFIED`       | User email is not verified       |
| 404         | `NOT_FOUND`                | Resource not found               |
| 409         | `CONFLICT`                 | Duplicate or invalid state       |
| 429         | `RATE_LIMITED`             | Too many requests                |
| 500         | `INTERNAL_ERROR`           | Unexpected server error          |

---

## 9.5 Pagination

Default query params:

```txt
page=1
pageSize=20
```

Rules:

- `page` minimum: 1
- `pageSize` minimum: 1
- `pageSize` maximum: 100
- Default `pageSize`: 20

Paginated response:

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

## 10. Authentication Specification

## 10.1 Authentication Model

The backend will use:

- Short-lived JWT access token
- Rotating opaque refresh token
- HTTP-only refresh cookie
- Bcrypt password hashing

---

## 10.2 Token Strategy

| Token                    | Type         | Lifetime   | Storage                   |
| ------------------------ | ------------ | ---------- | ------------------------- |
| Access token             | JWT          | 15 minutes | Returned in response body |
| Refresh token            | Opaque token | 7 days     | HTTP-only cookie          |
| Email verification token | Opaque token | 24 hours   | Database hashed           |
| Password reset token     | Opaque token | 30 minutes | Database hashed           |

---

## 10.3 Access Token JWT Payload

```json
{
  "sub": "user_id",
  "emailVerified": true,
  "type": "access"
}
```

Rules:

- Do not include sensitive data.
- Do not include password hash.
- Do not include refresh token.
- Access token must be stateless.

---

## 10.4 Refresh Token Rules

Refresh token must be:

- Generated using secure random bytes
- Stored hashed in database
- Single-use with rotation
- Revoked on logout
- Revoked on password reset
- Revoked or rotated on sensitive security changes

Database should store:

```txt
tokenHash
userId
expiresAt
revokedAt
replacedByHash
userAgent
ip
createdAt
```

---

## 10.5 Refresh Cookie Settings

Cookie name:

```txt
tally_rt
```

Settings:

```txt
httpOnly: true
secure: true in production
sameSite: none for cross-origin frontend/backend
path: /api/v1/auth
maxAge: 7 days
```

Local development may use:

```txt
secure: false
sameSite: lax
```

---

## 10.6 Password Rules

- Minimum length: 8 characters
- Maximum length: 72 bytes due to bcrypt
- Password must be hashed using bcrypt
- Password hash must never be returned by API
- Password reset invalidates existing sessions

---

# 11. Authentication Endpoints

## 11.1 Auth Route Table

| Method | Endpoint                                  | Auth   | Description                      |
| ------ | ----------------------------------------- | ------ | -------------------------------- |
| POST   | `/auth/register`                          | No     | Register with email/password     |
| POST   | `/auth/login`                             | No     | Login with email/password        |
| POST   | `/auth/logout`                            | Yes    | Logout and revoke refresh token  |
| POST   | `/auth/refresh`                           | Cookie | Refresh access token             |
| GET    | `/auth/me`                                | Yes    | Get current user                 |
| POST   | `/auth/verify-email`                      | No     | Verify email using token         |
| POST   | `/auth/resend-verification`               | No     | Resend verification email        |
| POST   | `/auth/forgot-password`                   | No     | Request password reset           |
| POST   | `/auth/reset-password`                    | No     | Reset password using token       |
| PATCH  | `/auth/change-password`                   | Yes    | Change password                  |
| POST   | `/auth/set-password`                      | Yes    | Set password for OAuth-only user |
| GET    | `/auth/connected-accounts`                | Yes    | List connected providers         |
| DELETE | `/auth/connected-accounts/:provider`      | Yes    | Unlink provider                  |
| POST   | `/auth/connected-accounts/:provider/link` | Yes    | Start linking a provider         |

---

## 11.2 Register

```txt
POST /api/v1/auth/register
```

Request body:

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

Behavior:

1. Validate input.
2. Check if email already exists.
3. Hash password.
4. Create user with `emailVerified = false`.
5. Create hashed email verification token.
6. Send verification email.
7. Return generic success response.

Response:

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "message": "Registration successful. Please verify your email."
  }
}
```

---

## 11.3 Login

```txt
POST /api/v1/auth/login
```

Request body:

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

Behavior:

1. Find user by email.
2. Verify password.
3. Check if email is verified.
4. Issue access token.
5. Create refresh token.
6. Store hashed refresh token.
7. Set refresh cookie.
8. Return access token and user.

Error cases:

- Invalid credentials
- Email not verified
- Rate limited

Success response:

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "accessToken": "jwt_token",
    "user": {
      "id": "user_id",
      "name": "John Doe",
      "email": "john@example.com",
      "emailVerified": true,
      "hasPassword": true,
      "providers": []
    }
  }
}
```

---

## 11.4 Refresh

```txt
POST /api/v1/auth/refresh
```

Behavior:

1. Read refresh cookie.
2. Hash incoming token.
3. Find token record.
4. Validate expiration and revocation.
5. If an already replaced/revoked token is replayed, revoke all refresh tokens
   for that user, clear the cookie, and require a fresh login.
6. Rotate refresh token.
7. Store new token hash.
8. Revoke old token.
9. Set new refresh cookie.
10. Return new access token.

Response:

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "accessToken": "new_jwt_token"
  }
}
```

---

## 11.5 Logout

```txt
POST /api/v1/auth/logout
```

Behavior:

1. Read refresh cookie.
2. Revoke refresh token.
3. Clear refresh cookie.

Response:

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "message": "Logged out"
  }
}
```

---

## 11.6 Get Current User

```txt
GET /api/v1/auth/me
```

Required header:

```txt
Authorization: Bearer <access_token>
```

Response:

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "user": {
      "id": "user_id",
      "name": "John Doe",
      "email": "john@example.com",
      "emailVerified": true,
      "hasPassword": true,
      "providers": ["google"],
      "preferences": {
        "theme": "system",
        "defaultLandingPage": "dashboard",
        "timeZone": "Asia/Dhaka",
        "notificationsEnabled": false
      }
    }
  }
}
```

---

## 11.7 Verify Email

```txt
POST /api/v1/auth/verify-email
```

Request body:

```json
{
  "token": "verification_token"
}
```

Behavior:

1. Hash token.
2. Find verification token record.
3. Validate expiration.
4. In one transaction, set `emailVerified=true`, set `emailVerifiedAt`, and
   delete/invalidate all verification tokens for the user.

Response:

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "message": "Email verified successfully"
  }
}
```

---

## 11.8 Resend Verification Email

```txt
POST /api/v1/auth/resend-verification
```

Request body:

```json
{
  "email": "john@example.com"
}
```

Behavior:

1. Find user by email.
2. If user exists and is unverified:
   - create new verification token
   - invalidate old verification token
   - send verification email
3. Always return generic response.

Response:

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "message": "If the account exists and is unverified, a verification email has been sent."
  }
}
```

---

## 11.9 Forgot Password

```txt
POST /api/v1/auth/forgot-password
```

Request body:

```json
{
  "email": "john@example.com"
}
```

Behavior:

1. Find user by email.
2. If user exists:
   - invalidate prior unused reset tokens
   - create hashed reset token
   - expire in 30 minutes
   - send reset email
3. Always return generic response.

Response:

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "message": "If an account exists for this email, a password reset link has been sent."
  }
}
```

---

## 11.10 Reset Password

```txt
POST /api/v1/auth/reset-password
```

Request body:

```json
{
  "token": "reset_token",
  "password": "new_password"
}
```

Behavior:

1. Hash token.
2. Validate token.
3. Validate password.
4. Update password hash.
5. Invalidate reset token.
6. Revoke all refresh tokens. Already-issued stateless access tokens remain
   valid only until their maximum 15-minute expiry.

Response:

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "message": "Password reset successful"
  }
}
```

---

## 11.11 Change Password

```txt
PATCH /api/v1/auth/change-password
```

Request body:

```json
{
  "currentPassword": "old_password",
  "newPassword": "new_password"
}
```

Behavior:

1. Require authenticated user.
2. If user has password:
   - verify current password.
3. Update password hash.
4. Revoke all other refresh tokens.
5. Keep current session active.

Response:

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "message": "Password changed successfully"
  }
}
```

---

## 11.12 Set Password for OAuth-only User

```txt
POST /api/v1/auth/set-password
```

Request body:

```json
{
  "newPassword": "password123"
}
```

Rules:

- Only authenticated users.
- Allowed only if user does not already have a password.
- If user already has password, return conflict and require change-password.

Behavior:

1. Validate password.
2. Store password hash.
3. Keep existing session active.

Response:

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "message": "Password set successfully"
  }
}
```

---

## 11.13 Connected Accounts

```txt
GET /api/v1/auth/connected-accounts
```

Response:

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "providers": [
      {
        "provider": "google",
        "connected": true,
        "email": "john@gmail.com"
      },
      {
        "provider": "github",
        "connected": false,
        "email": null
      }
    ],
    "hasPassword": true
  }
}
```

---

## 11.14 Link Provider

```txt
POST /api/v1/auth/connected-accounts/:provider/link
```

Rules:

- `provider` must be `google` or `github`.
- The request requires the normal Bearer access token.
- The backend creates a short-lived, one-time OAuth transaction containing the
  provider, `link` intent, authenticated user ID, expiry, and random nonce.
- Transaction state must be integrity-protected and bound to an HTTP-only cookie
  or server-side record; the callback must validate both OAuth `state` and the
  original authenticated user.
- The callback links the provider to that user and must never fall back to
  email-based login linking when the explicit `link` transaction is invalid.
- Return the provider `authorizationUrl`; the frontend navigates to it only
  after this authenticated mutation succeeds.
- Attempting to link a provider already connected to the same user is
  idempotent. A provider identity owned by another user returns `CONFLICT`.

Response:

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "authorizationUrl": "https://provider.example/authorize?..."
  }
}
```

---

## 11.15 Unlink Provider

```txt
DELETE /api/v1/auth/connected-accounts/:provider
```

Example:

```txt
DELETE /api/v1/auth/connected-accounts/google
```

Rules:

- Cannot unlink if it removes the last login method.
- Check remaining methods and delete the provider atomically so concurrent
  unlink requests cannot remove every login method.
- Login methods include:
  - password
  - Google
  - GitHub

Error response when last method:

```json
{
  "success": false,
  "message": "Cannot remove the last available login method",
  "error": {
    "code": "CONFLICT"
  },
  "meta": {
    "requestId": "request_id"
  }
}
```

---

# 12. OAuth Specification

## 12.1 Supported Providers

- Google
- GitHub

---

## 12.2 OAuth Endpoints

| Method | Endpoint                | Description           |
| ------ | ----------------------- | --------------------- |
| GET    | `/auth/google`          | Initiate Google OAuth |
| GET    | `/auth/google/callback` | Google OAuth callback |
| GET    | `/auth/github`          | Initiate GitHub OAuth |
| GET    | `/auth/github/callback` | GitHub OAuth callback |

---

## 12.3 OAuth Flow

```txt
User clicks provider login
  -> Frontend navigates to backend OAuth start endpoint
  -> Backend redirects to provider authorization URL
  -> User authorizes
  -> Provider redirects to backend callback
  -> Backend exchanges code for tokens/profile
  -> Backend validates email/provider identity
  -> Backend creates or links account
  -> Backend issues refresh cookie
  -> Backend redirects to frontend
  -> Frontend calls /auth/refresh and /auth/me
```

For `intent=link`, the callback links the provider to the authenticated user
captured by the validated OAuth transaction and returns to Settings. It does not
choose a user from provider email alone.

Recommended successful link redirect:

```txt
{WEB_APP_URL}/auth/social/callback?status=success&intent=link
```

---

## 12.4 OAuth Account Rules

### Case 1: Provider account already linked

```txt
Login as existing user.
```

### Case 2: No user exists, provider email verified

```txt
Create new user.
Set emailVerified = true.
Link provider.
```

### Case 3: User exists with same verified email

```txt
Link provider to existing user.
Login.
```

### Case 4: Provider email not verified

```txt
Do not create or link account.
Redirect to frontend with safe error state.
```

---

## 12.5 OAuth Redirect After Success

Recommended redirect:

```txt
{WEB_APP_URL}/auth/social/callback?status=success
```

The frontend must then restore session using:

```txt
POST /auth/refresh
GET /auth/me
```

---

## 12.6 OAuth Security Requirements

- Use `state` parameter to prevent CSRF.
- Validate `state` on callback.
- Bind provider-link state to the authenticated user and explicit `link` intent.
- Expire and consume OAuth transaction state after one callback attempt.
- Store provider account ID and email.
- Do not trust unverified provider emails.
- Do not expose OAuth client secret to frontend.
- Log OAuth failures without sensitive tokens.

---

# 13. User Endpoints

## 13.1 User Profile and Preferences

| Method | Endpoint                | Auth | Description        |
| ------ | ----------------------- | ---- | ------------------ |
| PATCH  | `/users/me/profile`     | Yes  | Update profile     |
| PATCH  | `/users/me/preferences` | Yes  | Update preferences |

---

## 13.2 Update Profile

```txt
PATCH /api/v1/users/me/profile
```

Request body:

```json
{
  "name": "John Doe"
}
```

Rules:

- Name optional but must be 1–100 characters if provided.
- Email cannot be changed in MVP.

Response:

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "user": {
      "id": "user_id",
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
}
```

---

## 13.3 Update Preferences

```txt
PATCH /api/v1/users/me/preferences
```

Request body:

```json
{
  "theme": "dark",
  "defaultLandingPage": "dashboard",
  "timeZone": "Asia/Dhaka",
  "notificationsEnabled": true
}
```

Allowed values:

```txt
theme: light | dark | system
defaultLandingPage: dashboard | applications
timeZone: valid IANA time-zone identifier
notificationsEnabled: boolean
```

The backend-stored preference is authoritative for authenticated users.

---

# 14. Application Endpoints

## 14.1 Route Table

| Method | Endpoint                      | Auth | Description           |
| ------ | ----------------------------- | ---- | --------------------- |
| GET    | `/applications`               | Yes  | List applications     |
| POST   | `/applications`               | Yes  | Create application    |
| GET    | `/applications/:id`           | Yes  | Get application       |
| PATCH  | `/applications/:id`           | Yes  | Update application    |
| DELETE | `/applications/:id`           | Yes  | Delete application    |
| POST   | `/applications/:id/archive`   | Yes  | Archive application   |
| POST   | `/applications/:id/unarchive` | Yes  | Unarchive application |
| POST   | `/applications/:id/status`    | Yes  | Change status         |
| GET    | `/applications/:id/history`   | Yes  | Get status history    |

`GET /applications/:id` returns the owned application and its assigned tag
objects. Notes, interviews, and status history remain paginatable/separate
resources and are loaded through their documented endpoints.

---

## 14.2 List Applications

```txt
GET /api/v1/applications
```

Query params:

```txt
page
pageSize
search
status
tag
remoteType
employmentType
source
appliedFrom
appliedTo
followUp
includeArchived
sort
order
```

Example:

```txt
GET /api/v1/applications?page=1&pageSize=20&status=APPLIED&followUp=overdue
```

Query rules:

- `appliedFrom` and `appliedTo` are valid `YYYY-MM-DD` calendar dates and the
  lower bound cannot be after the upper bound.
- `includeArchived` is a strict boolean and defaults to `false`.
- Unknown sort/filter values return `VALIDATION_ERROR`; they are not silently
  ignored.

Search fields:

- company
- role
- location
- tag names
- note content

Search is trimmed and case-insensitive. The free-text `source` filter is also a
case-insensitive exact match.

Note matching must preserve pagination correctness. Use a scoped relational
filter such as `notes: { some: { content: ... } }`/SQL `EXISTS`; do not join in a
way that duplicates application rows or corrupts the total count.

Follow-up values:

```txt
overdue
today
upcoming
none
```

Sort fields:

```txt
updatedAt
createdAt
company
role
appliedAt
nextFollowUpAt
status
```

Status sorting uses pipeline rank, not database/alphabetical enum order:

```txt
WISHLIST -> APPLIED -> SCREENING -> INTERVIEW -> OFFER -> REJECTED -> WITHDRAWN
```

All sort modes use `id` as a final deterministic tie-breaker so pagination does
not duplicate or skip rows when primary sort values are equal.

---

## 14.3 Create Application

```txt
POST /api/v1/applications
```

Request body:

```json
{
  "company": "Acme Corp",
  "role": "Frontend Engineer",
  "jobUrl": "https://jobs.acme.com/frontend",
  "location": "Remote",
  "remoteType": "REMOTE",
  "employmentType": "FULL_TIME",
  "source": "LinkedIn",
  "status": "APPLIED",
  "appliedAt": "2026-01-01",
  "salaryMin": 80000,
  "salaryMax": 100000,
  "currency": "USD",
  "nextFollowUpAt": "2026-01-10T09:00:00.000Z",
  "tagIds": [],
  "initialNote": "Applied through the company careers page."
}
```

Rules:

- `company` required.
- `role` required.
- Default status: `WISHLIST`.
- Application belongs to authenticated user.
- If `salaryMax` exists, it must be greater than or equal to `salaryMin`.
- `appliedAt` is an ISO calendar date (`YYYY-MM-DD`), not a timestamp.
- `initialNote`, when present, must contain 1–5000 characters.
- Validate that every tag belongs to the authenticated user.
- Create the application, tag assignments, initial note, and any initial
  non-default status history entry in one transaction.

---

## 14.4 Update Application

```txt
PATCH /api/v1/applications/:id
```

Rules:

- User must own application.
- Accept the mutable create fields plus optional `tagIds`, but never `status`.
- Validate that every replacement tag belongs to the user.
- When `tagIds` is present, replace assignments in the same transaction as the
  application field update. Omitted `tagIds` leaves assignments unchanged.
- Update `updatedAt`.
- If status changed, use dedicated status endpoint instead.

---

## 14.5 Delete Application

```txt
DELETE /api/v1/applications/:id
```

Rules:

- User must own application.
- Related notes, interviews, tags mapping, and status history should be deleted through database cascade.

---

## 14.6 Archive / Unarchive

Archive:

```txt
POST /api/v1/applications/:id/archive
```

Unarchive:

```txt
POST /api/v1/applications/:id/unarchive
```

Behavior:

- Archive sets `archivedAt`.
- Unarchive clears `archivedAt`.
- Archived applications are hidden by default in list queries unless `includeArchived=true`.

---

## 14.7 Change Status

```txt
POST /api/v1/applications/:id/status
```

Request body:

```json
{
  "toStatus": "INTERVIEW",
  "note": "Recruiter confirmed technical interview"
}
```

Behavior:

1. Validate current ownership.
2. Validate status enum.
3. Reject the current status as `CONFLICT`; do not create a no-op history row.
4. Start transaction.
5. Update application status.
6. Create status history entry.
7. Commit transaction.

Response:

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "application": {
      "id": "application_id",
      "status": "INTERVIEW"
    }
  }
}
```

---

## 14.8 Status History

```txt
GET /api/v1/applications/:id/history
```

Response:

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "history": [
      {
        "id": "history_id",
        "fromStatus": "APPLIED",
        "toStatus": "INTERVIEW",
        "note": "Recruiter confirmed technical interview",
        "changedAt": "2026-01-05T10:00:00.000Z"
      }
    ]
  }
}
```

---

# 15. Tag Endpoints

| Method | Endpoint                        | Auth | Description                 |
| ------ | ------------------------------- | ---- | --------------------------- |
| GET    | `/tags`                         | Yes  | List user tags              |
| POST   | `/tags`                         | Yes  | Create tag                  |
| PATCH  | `/tags/:id`                     | Yes  | Update tag                  |
| DELETE | `/tags/:id`                     | Yes  | Delete tag                  |
| POST   | `/applications/:id/tags`        | Yes  | Add tags to application     |
| DELETE | `/applications/:id/tags/:tagId` | Yes  | Remove tag from application |

`GET /tags` sorts normalized names ascending.

---

## 15.1 Create Tag

```txt
POST /api/v1/tags
```

Request body:

```json
{
  "name": "priority",
  "color": "#6366f1"
}
```

Rules:

- Tag name unique per user.
- Color optional.
- Maximum name length: 50 characters.

---

## 15.2 Add Tags to Application

```txt
POST /api/v1/applications/:id/tags
```

Request body:

```json
{
  "tagIds": ["tag_id_1", "tag_id_2"]
}
```

Rules:

- Tags must belong to authenticated user.
- Application must belong to authenticated user.
- Duplicate assignments are ignored so the operation is idempotent.

Update/delete rules:

- `PATCH /tags/:id` accepts `name` and/or `color`, applies canonical
  normalization, and enforces user ownership.
- `DELETE /tags/:id` deletes only an owned tag and cascades assignments without
  deleting applications.
- Duplicate add requests are idempotent and return success with the resulting
  assignment set.

---

# 16. Note Endpoints

| Method | Endpoint                  | Auth | Description |
| ------ | ------------------------- | ---- | ----------- |
| GET    | `/applications/:id/notes` | Yes  | List notes  |
| POST   | `/applications/:id/notes` | Yes  | Create note |
| PATCH  | `/notes/:id`              | Yes  | Update note |
| DELETE | `/notes/:id`              | Yes  | Delete note |

Note-list responses sort by `createdAt` descending and use `id` as a stable
tie-breaker.

---

## 16.1 Create Note

```txt
POST /api/v1/applications/:id/notes
```

Request body:

```json
{
  "content": "Recruiter asked for updated resume."
}
```

Rules:

- Content required.
- Minimum length: 1
- Maximum length: 5000
- Application must belong to user.

Update/delete rules:

- `PATCH /notes/:id` accepts `content` under the same validation rules and
  verifies ownership through the parent application.
- `DELETE /notes/:id` verifies ownership through the parent application.

---

# 17. Interview Endpoints

| Method | Endpoint                       | Auth | Description                     |
| ------ | ------------------------------ | ---- | ------------------------------- |
| GET    | `/interviews`                  | Yes  | List user interviews            |
| GET    | `/applications/:id/interviews` | Yes  | List interviews for application |
| POST   | `/applications/:id/interviews` | Yes  | Create interview                |
| PATCH  | `/interviews/:id`              | Yes  | Update interview                |
| DELETE | `/interviews/:id`              | Yes  | Delete interview                |

---

## 17.1 List Interviews Query Params

```txt
range=upcoming | past
page
pageSize
includeArchived=false
```

Rules:

- `upcoming` means `scheduledAt >= now()` and sorts ascending.
- `past` means `scheduledAt < now()` and sorts descending.
- Both ranges may display any interview status; status badges communicate
  completed/cancelled/no-show records.
- Interviews belonging to archived applications are excluded unless
  `includeArchived=true`.

---

## 17.2 Create Interview

```txt
POST /api/v1/applications/:id/interviews
```

Request body:

```json
{
  "type": "TECHNICAL",
  "scheduledAt": "2026-01-15T14:00:00.000Z",
  "interviewerName": "Jane Smith",
  "meetingLink": "https://meet.google.com/abc",
  "location": "Remote",
  "notes": "Prepare system design",
  "status": "SCHEDULED"
}
```

Allowed interview types:

```txt
PHONE
TECHNICAL
HR
SYSTEM_DESIGN
ONSITE
OTHER
```

Allowed interview statuses:

```txt
SCHEDULED
COMPLETED
CANCELLED
NO_SHOW
```

Update/delete rules:

- `PATCH /interviews/:id` accepts any documented interview field and validates
  ownership through the parent application.
- The parent application cannot be changed by the interview update endpoint.
- `DELETE /interviews/:id` verifies ownership through the parent application.

---

# 18. Dashboard Endpoint

```txt
GET /api/v1/dashboard/summary
```

Response:

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "totalApplications": 25,
    "activeApplications": 12,
    "scheduledInterviews": 3,
    "offers": 1,
    "followUps": {
      "overdueCount": 2,
      "todayCount": 1,
      "overdue": [],
      "today": []
    },
    "statusCounts": {
      "WISHLIST": 3,
      "APPLIED": 8,
      "SCREENING": 2,
      "INTERVIEW": 3,
      "OFFER": 1,
      "REJECTED": 6,
      "WITHDRAWN": 2
    },
    "upcomingInterviews": [],
    "recentApplications": []
  }
}
```

Dashboard list item shapes:

```ts
type FollowUpItem = {
  id: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  nextFollowUpAt: string;
};

type UpcomingInterviewItem = {
  id: string;
  type: InterviewType;
  status: "SCHEDULED";
  scheduledAt: string;
  application: { id: string; company: string; role: string };
};

type RecentApplicationItem = {
  id: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  updatedAt: string;
};
```

Rules:

- Only count current user data.
- Exclude archived applications from every dashboard metric and list.
- `activeApplications` counts `APPLIED`, `SCREENING`, and `INTERVIEW`.
- `scheduledInterviews` counts future `SCHEDULED` interviews only.
- Follow-up `overdue`/`today` arrays contain compact application summaries and
  use the user's stored IANA time zone to calculate day boundaries.
- Upcoming interviews are sorted ascending; recent applications are sorted by
  `updatedAt` descending. Both lists have a documented fixed limit (recommended
  five items).
- Use efficient aggregate queries.

---

# 19. Export / Import Endpoints

| Method | Endpoint       | Auth | Description              |
| ------ | -------------- | ---- | ------------------------ |
| GET    | `/export/json` | Yes  | Export all user data     |
| GET    | `/export/csv`  | Yes  | Export applications CSV  |
| POST   | `/import/json` | Yes  | Import/replace user data |

---

## 19.1 Export JSON

This endpoint returns a raw downloadable JSON document, not the normal response
envelope.

Required headers:

```txt
Content-Type: application/json
Content-Disposition: attachment; filename="tally-backup-YYYY-MM-DD.json"
```

Canonical shape:

```json
{
  "version": 1,
  "exportedAt": "2026-01-01T00:00:00.000Z",
  "profile": {
    "name": "John Doe",
    "preferences": {
      "theme": "SYSTEM",
      "defaultLandingPage": "DASHBOARD",
      "timeZone": "Asia/Dhaka",
      "notificationsEnabled": false
    }
  },
  "tags": [{ "ref": "tag-1", "name": "priority", "color": "#6366f1" }],
  "applications": [
    {
      "ref": "application-1",
      "company": "Acme Corp",
      "role": "Frontend Engineer",
      "tagRefs": ["tag-1"],
      "notes": [],
      "interviews": [],
      "statusHistory": []
    }
  ]
}
```

The real document includes every portable application field. Export references
are file-local association keys, not database IDs. Email, password hashes,
OAuth identities, and all authentication tokens are excluded.

---

## 19.2 Export CSV

Return raw `text/csv; charset=utf-8` with `Content-Disposition: attachment`.

CSV columns:

```txt
company
role
status
jobUrl
location
remoteType
employmentType
source
appliedAt
nextFollowUpAt
salaryMin
salaryMax
currency
tags
createdAt
updatedAt
```

Use RFC 4180 quoting. The `tags` cell contains a JSON array of tag names so
commas or other punctuation in names remain unambiguous. CSV import is not part
of MVP. Neutralize spreadsheet-formula prefixes (`=`, `+`, `-`, `@`, tab, or
carriage return) in user-controlled cells to prevent CSV injection.

---

## 19.3 Import JSON

```txt
POST /api/v1/import/json
```

Rules:

- Accept the canonical raw version-1 backup shape from Export JSON.
- Reject unknown schema versions and invalid/dangling references.
- Validate the entire document and payload size before deleting or writing data.
- Replace current user application data inside one transaction; any failure
  rolls back the complete import.
- Regenerate all database IDs and resolve file-local `ref`/`tagRefs` values.
- Validate status-history ordering/transitions and require its last status to
  agree with the imported application's current status.
- Preserve user account itself.
- Only import the documented profile/preferences fields; never import email,
  password hashes, OAuth identities, or auth tokens even if supplied.

Recommended payload limit:

```txt
1 MB
```

---

# 20. Health Endpoint

```txt
GET /api/v1/health
```

Response:

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "status": "ok",
    "database": "connected",
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

Behavior:

- Check database connectivity.
- Do not require authentication.
- Do not expose sensitive internals.

---

# 21. Validation Specification

Use Zod for validation.

Canonical limits:

| Field               | Rule                                            |
| ------------------- | ----------------------------------------------- |
| User name           | Trimmed, 1–100 characters                       |
| Password            | 8 characters minimum and 72 UTF-8 bytes maximum |
| Company / role      | Trimmed, 1–100 characters                       |
| Job/meeting URL     | Valid absolute `http` or `https` URL            |
| Location            | Maximum 120 characters                          |
| Source              | Maximum 100 characters                          |
| Currency            | Exactly three uppercase ASCII letters           |
| Tag name            | Trimmed/lowercased, 1–50 characters             |
| Tag color           | Optional `#RRGGBB` hex value                    |
| Note / initial note | Trimmed, 1–5000 characters                      |
| Time zone           | Valid IANA time-zone identifier                 |

Date rules:

- `appliedAt` accepts `YYYY-MM-DD` and remains a calendar date.
- Interview and follow-up timestamps accept ISO 8601 values with an explicit
  offset or `Z`, then normalize to UTC.
- `salaryMin`/`salaryMax` are non-negative and max is not below min.
- `currency` is required when either salary value is present.

Validate:

- Request body
- Query params
- Route params
- Cookie values where applicable

Validation middleware behavior:

```txt
Invalid request
  -> Return 400
  -> Code: VALIDATION_ERROR
  -> Include flattened field errors
```

Example:

```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": {
      "company": ["Required"]
    }
  },
  "meta": {
    "requestId": "request_id"
  }
}
```

---

# 22. Authorization Specification

## 22.1 Authentication Middleware

Responsibilities:

- Read `Authorization` header
- Verify JWT
- Attach user to request object

Example:

```ts
req.user = {
  id: string;
  email: string;
  emailVerified: boolean;
};
```

---

## 22.2 Verified Middleware

Protected application routes require:

```txt
authenticated = true
emailVerified = true
```

If not verified:

```json
{
  "success": false,
  "message": "Please verify your email to continue",
  "error": {
    "code": "EMAIL_NOT_VERIFIED"
  },
  "meta": {
    "requestId": "request_id"
  }
}
```

---

## 22.3 Ownership Rules

Every user-owned resource must enforce ownership.

Resources:

- applications
- tags
- notes
- interviews
- status history
- export/import data

Rules:

- Repository queries should filter by `userId`.
- Services should verify ownership before mutation.
- Return 404 for resources not owned to avoid leaking existence.

---

# 23. Error Handling Specification

Use a centralized error handler.

Custom error class:

```ts
class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;
}
```

Rules:

- Controllers should throw `ApiError`.
- Async handlers should catch errors.
- Unknown errors return 500.
- Validation errors return 400.
- Auth errors return 401.
- Ownership/resource-existence checks return 404 to avoid leaking another
  user's resource existence.
- Log errors with request ID.
- Do not leak stack traces in production responses.

---

# 24. Logging Specification

Use structured logging.

Recommended logger:

```txt
pino
```

Log:

- Request method
- Request path
- Status code
- Duration
- Request ID
- Error messages

Do not log:

- Passwords
- Access tokens
- Refresh tokens
- Email bodies with tokens
- Authorization headers
- Cookies

---

# 25. Security Specification

## 25.1 Required Security Middleware

- helmet
- cors
- cookie-parser
- express-rate-limit
- compression
- request-id
- JSON body size limit

Recommended body limit:

```txt
1mb
```

---

## 25.2 CORS

CORS must be environment-driven.

```ts
const corsOptions = {
  origin: env.WEB_APP_URL,
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};
```

---

## 25.3 CSRF Protection

Most authenticated mutations use Bearer access token, reducing CSRF risk.

Cookie-based endpoints:

```txt
/auth/refresh
/auth/logout
```

For these endpoints, allowed-origin validation is required. SameSite cookie
settings are defense in depth and do not replace this check.

```txt
Require Origin header to match WEB_APP_URL
```

Also require `X-Requested-With: XMLHttpRequest` for these requests.

---

## 25.4 Rate Limiting

Recommended limits:

| Area                   | Limit                            |
| ---------------------- | -------------------------------- |
| Global API             | 300 requests / 15 minutes per IP |
| Auth endpoints         | 10 requests / 15 minutes per IP  |
| Password reset request | 5 requests / hour per IP         |
| Resend verification    | 5 requests / hour per IP         |

Production may use Redis or managed rate limit storage.

---

## 25.5 Token Security

- Hash refresh tokens before storing.
- Hash verification/reset tokens before storing.
- Use secure random generation.
- Enforce expiration.
- Rotate refresh tokens.
- Revoke tokens after password reset.
- Do not put tokens in URLs except email action tokens.

---

## 25.6 Password Security

- Use bcrypt with cost factor 10–12.
- Do not return password hash.
- Do not reveal whether email exists during login or password recovery.

---

# 26. Email Specification

## 26.1 Email Service Abstraction

Create an email service interface:

```ts
interface EmailService {
  sendVerificationEmail(email: string, token: string): Promise<void>;
  sendPasswordResetEmail(email: string, token: string): Promise<void>;
}
```

Providers can implement:

- Resend
- SendGrid
- Mailgun
- SMTP

The current API provides concrete adapters for Resend, SendGrid, Mailgun, and
SMTP through `src/email/email.service.ts`. Provider credentials are validated
at startup; console delivery is development-only. Email delivery failures are
logged with provider and error type only, never recipient, token, URL, or
message body.

---

## 26.2 Email Links

Verification link:

```txt
{WEB_APP_URL}/verify-email?token={token}
```

Password reset link:

```txt
{WEB_APP_URL}/reset-password?token={token}
```

---

## 26.3 Development Email Behavior

In development:

- If email provider is not configured, log email link to console.
- Do not log email links in production.

---

# 27. Database Access Specification

Use Prisma for all database access.

With Prisma 7, create the runtime client with `@prisma/adapter-pg` and import the
generated client from `src/generated/prisma`; do not assume the legacy
`@prisma/client` generation path.

Responsibilities:

- Schema definition
- Migrations
- Type-safe queries
- Transactions

Use transactions for:

- Status change
- Import replacement
- User deletion
- Complex multi-table writes

Repository layer should avoid exposing Prisma internals to controllers.

---

# 28. Environment Variables

`.env.example`:

```txt
NODE_ENV=development
PORT=4000

DATABASE_URL=postgresql://tally:tally@localhost:5433/tally
MIGRATION_DATABASE_URL=

WEB_APP_URL=http://localhost:3000

ACCESS_TOKEN_SECRET=change_me

ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

EMAIL_PROVIDER=console
EMAIL_API_KEY=
EMAIL_FROM=no-reply@tally.local

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

COOKIE_SECURE=false
COOKIE_SAME_SITE=lax

LOG_LEVEL=debug
```

Production:

```txt
NODE_ENV=production
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
LOG_LEVEL=info
EMAIL_PROVIDER=production_provider
```

Environment validation must run at startup.

---

# 29. Config Validation

Use Zod to validate environment variables.

Required production variables:

```txt
DATABASE_URL
WEB_APP_URL
ACCESS_TOKEN_SECRET
EMAIL_PROVIDER
EMAIL_FROM
```

`ACCESS_TOKEN_SECRET` must contain at least 32 bytes of unpredictable material.

Production must reject `EMAIL_PROVIDER=console`. Provider-specific credentials
such as `EMAIL_API_KEY` are required whenever the selected adapter needs them.

Because both providers are MVP Must Haves, production requires:

```txt
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
```

If required variables are missing, the server must fail to start.

---

# 30. Testing Specification

## 30.1 Unit Tests

Test:

- Password hashing utilities
- Token hashing utilities
- JWT utilities
- Auth service logic
- Application service logic
- Status transition logic
- Validation schemas
- Pagination helpers

---

## 30.2 Integration Tests

Use Supertest with a test database.

Test:

- Health endpoint
- Register
- Login
- Email verification
- Resend verification
- Forgot password
- Reset password
- Change password
- Set password
- Refresh token rotation
- Logout
- Protected route unauthorized access
- Application CRUD
- Ownership enforcement
- Status history creation
- Tags CRUD
- Notes CRUD
- Interviews CRUD
- Export/import validation

---

## 30.3 Test Database

Use a separate PostgreSQL test database.

Example:

```txt
tally_test
```

CI should:

- Start PostgreSQL service
- Run migrations
- Run tests
- Tear down database

---

# 31. Scripts

Recommended `package.json` scripts:

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/server.js",
    "lint": "eslint src",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy",
    "prisma:studio": "prisma studio",
    "prisma:seed": "tsx prisma/seed.ts"
  }
}
```

---

# 32. Runtime Requirements

The backend must:

- Start only after environment validation passes
- Expose `/api/v1/health`
- Handle JSON parse errors gracefully
- Handle 404 routes
- Handle unexpected errors centrally
- Gracefully shutdown on SIGTERM/SIGINT
- Disconnect Prisma on shutdown
- Use request IDs for traceability

---

# 33. Backend Acceptance Criteria

The backend is complete when:

- Express API runs with TypeScript.
- Prisma connects to PostgreSQL.
- Health endpoint works.
- Register/login/logout works.
- Email verification works.
- Resend verification works.
- Forgot/reset password works.
- Change password works.
- Set password for OAuth-only users works.
- Google OAuth works.
- GitHub OAuth works.
- Connected accounts can be viewed, linked, and unlinked safely.
- Refresh token rotation works.
- Access tokens are validated.
- Protected routes enforce authentication and verification.
- Application CRUD works.
- Ownership checks work.
- Status history works.
- Tags, notes, and interviews work.
- Dashboard summary works.
- Export/import works.
- Validation errors are structured.
- Error handling is centralized.
- Rate limiting works on auth endpoints.
- Allowed-origin and requested-with checks protect refresh/logout endpoints.
- Logger avoids sensitive data.
- Unit and integration tests pass.
- Environment validation works.
- Production build starts successfully.
