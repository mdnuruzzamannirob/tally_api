# Database Specification

## Job Application Tracker

**Version:** 1.0
**Status:** Final for MVP
**Related Documents:**

- Product Requirements Document v1.1
- UI/UX Specification v1.1
- Frontend Specification v1.0
- Backend Specification v1.0
  **Database:** PostgreSQL
  **ORM:** Prisma 7+

---

## 1. Purpose and Scope

This document defines the database design and data-layer requirements for Job Application Tracker.

It covers:

- Database choice
- Naming conventions
- Entity relationship overview
- Enums
- Table definitions
- Prisma schema
- Relationships
- Constraints
- Indexing strategy
- Cascade rules
- Migration strategy
- Seed data
- Testing database strategy
- Backup and security considerations
- Performance considerations

The database must support authentication, OAuth, email verification, password recovery, application tracking, tags, notes, interviews, status history, user preferences, and export/import.

---

## 2. Database Choice

| Concern              | Decision                                                                  |
| -------------------- | ------------------------------------------------------------------------- |
| Database engine      | PostgreSQL                                                                |
| ORM                  | Prisma 7+ with PostgreSQL driver adapter                                  |
| Primary key strategy | `cuid` string IDs                                                         |
| Timestamp type       | `timestamp with time zone` via Prisma `DateTime @db.Timestamptz(3)`       |
| Calendar date type   | PostgreSQL `date` via Prisma `DateTime @db.Date`                          |
| Money/salary type    | Decimal                                                                   |
| Migration tool       | Prisma Migrate                                                            |
| Local database       | Dockerized PostgreSQL                                                     |
| Production database  | Neon PostgreSQL; Supabase or Render PostgreSQL are equivalent substitutes |

PostgreSQL is selected because the data is relational, user-scoped, and requires strong integrity constraints.

### Prisma schema layout

The Prisma schema is split only for organization; it remains one Prisma schema
and preserves the existing migration history and database constraints.

```txt
prisma/
├── schema/
│   ├── base.prisma                 # generator and datasource
│   ├── enums/
│   │   ├── auth.enums.prisma
│   │   └── application.enums.prisma
│   └── models/
│       ├── user.prisma
│       ├── auth-token.prisma
│       ├── oauth-account.prisma
│       ├── application.prisma
│       ├── tag.prisma
│       ├── note.prisma
│       ├── interview.prisma
│       └── status-history.prisma
├── migrations/
└── seed.ts
```

`prisma.config.ts` targets `prisma/schema`; generated client output remains
`src/generated/prisma`.

---

## 3. Database Design Principles

1. All application data must be user-scoped.
2. Foreign keys must enforce relationships.
3. Cascade rules must prevent orphan records.
4. Tokens must be stored hashed.
5. Passwords must be stored hashed.
6. Sensitive secrets must not be stored in plaintext.
7. Soft archive is used for applications, not hard deletion by default.
8. Status history is immutable.
9. Indexes should support common dashboard and list queries.
10. Migrations must be repeatable across environments.

---

## 4. Naming Conventions

### Prisma Models

Use PascalCase model names:

```txt
User
Application
Tag
Note
Interview
StatusHistory
```

### Database Tables

Use snake_case plural table names:

```txt
users
oauth_accounts
refresh_tokens
email_verification_tokens
password_reset_tokens
applications
tags
application_tags
notes
interviews
status_history
```

### Columns

PostgreSQL columns must use snake_case.

Prisma model fields use camelCase and map every physical column with `@map`.

Example:

```prisma
userId String @map("user_id")
```

The mapping is required because the custom SQL constraints and operational
queries in this specification use physical snake_case names.

---

## 5. Entity Relationship Overview

```txt
User
├── OAuth accounts
├── Refresh tokens
├── Email verification tokens
├── Password reset tokens
├── Applications
│   ├── Notes
│   ├── Interviews
│   ├── Status history
│   └── Application tags
└── Tags
    └── Application tags
```

### Relationship Summary

| Parent      | Child                  | Relationship |
| ----------- | ---------------------- | ------------ |
| User        | OAuthAccount           | one-to-many  |
| User        | RefreshToken           | one-to-many  |
| User        | EmailVerificationToken | one-to-many  |
| User        | PasswordResetToken     | one-to-many  |
| User        | Application            | one-to-many  |
| User        | Tag                    | one-to-many  |
| Application | Note                   | one-to-many  |
| Application | Interview              | one-to-many  |
| Application | StatusHistory          | one-to-many  |
| Application | ApplicationTag         | one-to-many  |
| Tag         | ApplicationTag         | one-to-many  |

---

## 6. Enums

```prisma
enum ApplicationStatus {
  WISHLIST
  APPLIED
  SCREENING
  INTERVIEW
  OFFER
  REJECTED
  WITHDRAWN
}

enum RemoteType {
  ONSITE
  REMOTE
  HYBRID
}

enum EmploymentType {
  FULL_TIME
  CONTRACT
  INTERNSHIP
}

enum InterviewType {
  PHONE
  TECHNICAL
  HR
  SYSTEM_DESIGN
  ONSITE
  OTHER
}

enum InterviewStatus {
  SCHEDULED
  COMPLETED
  CANCELLED
  NO_SHOW
}

enum OauthProvider {
  GOOGLE
  GITHUB
}

enum ThemePreference {
  LIGHT
  DARK
  SYSTEM
}

enum LandingPagePreference {
  DASHBOARD
  APPLICATIONS
}
```

---

## 7. Core Table Specifications

## 7.1 users

Stores user account data and preferences.

| Column                | Type        | Required | Notes                     |
| --------------------- | ----------- | -------- | ------------------------- |
| id                    | string/cuid | Yes      | Primary key               |
| name                  | string      | No       | User display name         |
| email                 | string      | Yes      | Unique, lowercase         |
| password_hash         | string      | No       | Null for OAuth-only users |
| email_verified        | boolean     | Yes      | Default false             |
| email_verified_at     | timestamp   | No       | Verification timestamp    |
| theme                 | enum        | Yes      | Default `SYSTEM`          |
| default_landing_page  | enum        | Yes      | Default `DASHBOARD`       |
| time_zone             | string      | Yes      | IANA zone, default `UTC`  |
| notifications_enabled | boolean     | Yes      | Default false             |
| created_at            | timestamp   | Yes      | Auto                      |
| updated_at            | timestamp   | Yes      | Auto                      |

### Rules

- Email must be unique.
- Email should be normalized to lowercase before save.
- `password_hash` must never be returned by API.
- OAuth-only users can have null `password_hash`.
- Preferences are stored on user for MVP.
- `time_zone` must be a valid IANA time-zone identifier at the API boundary.
- When `email_verified` becomes true, set `email_verified_at`; verified OAuth
  account creation follows the same invariant.

---

## 7.2 oauth_accounts

Stores linked social login providers.

| Column              | Type        | Required | Notes               |
| ------------------- | ----------- | -------- | ------------------- |
| id                  | string/cuid | Yes      | Primary key         |
| user_id             | string      | Yes      | FK to users         |
| provider            | enum        | Yes      | Google/GitHub       |
| provider_account_id | string      | Yes      | Provider user ID    |
| email               | string      | No       | Email from provider |
| created_at          | timestamp   | Yes      | Auto                |

### Constraints

```txt
UNIQUE(provider, provider_account_id)
UNIQUE(user_id, provider)
```

### Rules

- A provider account can belong to only one user.
- A user can have multiple providers.
- A user can link at most one account for each provider in MVP.
- Provider email may be unverified; backend must validate trust rules.

---

## 7.3 refresh_tokens

Stores hashed refresh tokens.

| Column           | Type        | Required | Notes                |
| ---------------- | ----------- | -------- | -------------------- |
| id               | string/cuid | Yes      | Primary key          |
| user_id          | string      | Yes      | FK to users          |
| token_hash       | string      | Yes      | Unique               |
| expires_at       | timestamp   | Yes      | Expiry               |
| revoked_at       | timestamp   | No       | Revocation timestamp |
| replaced_by_hash | string      | No       | Rotation reference   |
| user_agent       | string      | No       | Optional metadata    |
| ip               | string      | No       | Optional metadata    |
| created_at       | timestamp   | Yes      | Auto                 |

### Rules

- Store only hashed token.
- Token rotation must revoke old token.
- Logout must revoke token.
- Password reset should revoke user sessions.

---

## 7.4 email_verification_tokens

Stores hashed email verification tokens.

| Column     | Type        | Required | Notes                |
| ---------- | ----------- | -------- | -------------------- |
| id         | string/cuid | Yes      | Primary key          |
| user_id    | string      | Yes      | FK to users          |
| token_hash | string      | Yes      | Unique               |
| expires_at | timestamp   | Yes      | 24 hours recommended |
| created_at | timestamp   | Yes      | Auto                 |

### Rules

- Token must be hashed before storage.
- Old tokens should be invalidated when a new verification email is requested.
- Token should be deleted or invalidated after successful verification.

---

## 7.5 password_reset_tokens

Stores hashed password reset tokens.

| Column     | Type        | Required | Notes                  |
| ---------- | ----------- | -------- | ---------------------- |
| id         | string/cuid | Yes      | Primary key            |
| user_id    | string      | Yes      | FK to users            |
| token_hash | string      | Yes      | Unique                 |
| expires_at | timestamp   | Yes      | 30 minutes recommended |
| used_at    | timestamp   | No       | Marks usage            |
| created_at | timestamp   | Yes      | Auto                   |

### Rules

- Token must be single-use.
- Token must expire quickly.
- Issuing a new reset token invalidates prior unused reset tokens for that user.
- Successful reset should revoke refresh tokens.

---

## 7.6 applications

Stores job applications.

| Column            | Type        | Required | Notes                         |
| ----------------- | ----------- | -------- | ----------------------------- |
| id                | string/cuid | Yes      | Primary key                   |
| user_id           | string      | Yes      | FK to users                   |
| company           | string      | Yes      | Required                      |
| role              | string      | Yes      | Required                      |
| job_url           | string      | No       | Valid URL                     |
| location          | string      | No       | Location                      |
| remote_type       | enum        | No       | Onsite/Remote/Hybrid          |
| employment_type   | enum        | No       | Full-time/Contract/Internship |
| source            | string      | No       | LinkedIn, referral, etc.      |
| status            | enum        | Yes      | Default `WISHLIST`            |
| applied_at        | date        | No       | Calendar date applied         |
| salary_min        | decimal     | No       | Minimum salary                |
| salary_max        | decimal     | No       | Maximum salary                |
| currency          | char(3)     | No       | Example: USD                  |
| next_follow_up_at | timestamp   | No       | Follow-up date                |
| archived_at       | timestamp   | No       | Soft archive                  |
| created_at        | timestamp   | Yes      | Auto                          |
| updated_at        | timestamp   | Yes      | Auto                          |

### Rules

- Application belongs to one user.
- Archived applications remain in database.
- Default list queries should exclude archived unless requested.
- Salary values must be non-negative.
- If both salary values exist, `salary_max >= salary_min`.

---

## 7.7 tags

Stores user-defined tags.

| Column     | Type        | Required | Notes          |
| ---------- | ----------- | -------- | -------------- |
| id         | string/cuid | Yes      | Primary key    |
| user_id    | string      | Yes      | FK to users    |
| name       | string      | Yes      | Tag name       |
| color      | string      | No       | Optional color |
| created_at | timestamp   | Yes      | Auto           |

### Constraints

```txt
UNIQUE(user_id, name)
```

### Rules

- Tag names are unique per user.
- Tag names are trimmed and lowercased before persistence so the composite
  unique constraint is case-insensitive in practice.
- Tag deletion removes tag assignments.

---

## 7.8 application_tags

Join table between applications and tags.

| Column         | Type      | Required | Notes              |
| -------------- | --------- | -------- | ------------------ |
| application_id | string    | Yes      | FK to applications |
| tag_id         | string    | Yes      | FK to tags         |
| assigned_at    | timestamp | Yes      | Auto               |

### Constraints

```txt
PRIMARY KEY(application_id, tag_id)
```

### Rules

- One tag can be assigned once per application.
- Deleting application deletes assignments.
- Deleting tag deletes assignments.

---

## 7.9 notes

Stores notes for applications.

| Column         | Type        | Required | Notes               |
| -------------- | ----------- | -------- | ------------------- |
| id             | string/cuid | Yes      | Primary key         |
| application_id | string      | Yes      | FK to applications  |
| content        | text        | Yes      | Max 5000 characters |
| created_at     | timestamp   | Yes      | Auto                |
| updated_at     | timestamp   | Yes      | Auto                |

### Rules

- Note belongs to one application.
- Notes cascade delete when application is deleted.
- Content length should be validated in API and DB.

---

## 7.10 interviews

Stores interviews linked to applications.

| Column           | Type        | Required | Notes                   |
| ---------------- | ----------- | -------- | ----------------------- |
| id               | string/cuid | Yes      | Primary key             |
| application_id   | string      | Yes      | FK to applications      |
| type             | enum        | Yes      | Phone/Technical/HR/etc. |
| scheduled_at     | timestamp   | Yes      | Interview time          |
| interviewer_name | string      | No       | Interviewer             |
| meeting_link     | string      | No       | URL                     |
| location         | string      | No       | Location                |
| notes            | text        | No       | Interview notes         |
| status           | enum        | Yes      | Default `SCHEDULED`     |
| created_at       | timestamp   | Yes      | Auto                    |
| updated_at       | timestamp   | Yes      | Auto                    |

### Rules

- Interview belongs to one application.
- Interviews cascade delete when application is deleted.
- Upcoming interview queries should sort by `scheduled_at`.

---

## 7.11 status_history

Stores application status changes.

| Column         | Type        | Required | Notes              |
| -------------- | ----------- | -------- | ------------------ |
| id             | string/cuid | Yes      | Primary key        |
| application_id | string      | Yes      | FK to applications |
| from_status    | enum        | Yes      | Previous status    |
| to_status      | enum        | Yes      | New status         |
| note           | string      | No       | Optional note      |
| changed_at     | timestamp   | Yes      | Auto               |

### Rules

- Status history entries are immutable.
- Entries cascade delete when application is deleted.
- Every status change must create one history row.

---

# 8. Prisma Schema

Below is the recommended Prisma schema for MVP.

Prisma 7 reads the connection URL from root `prisma.config.ts` rather than the
schema datasource block:

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const migrationUrl = process.env.MIGRATION_DATABASE_URL || env("DATABASE_URL");

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationUrl,
  },
});
```

```prisma
generator client {
  provider = "prisma-client"
  output   = "../../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum ApplicationStatus {
  WISHLIST
  APPLIED
  SCREENING
  INTERVIEW
  OFFER
  REJECTED
  WITHDRAWN
}

enum RemoteType {
  ONSITE
  REMOTE
  HYBRID
}

enum EmploymentType {
  FULL_TIME
  CONTRACT
  INTERNSHIP
}

enum InterviewType {
  PHONE
  TECHNICAL
  HR
  SYSTEM_DESIGN
  ONSITE
  OTHER
}

enum InterviewStatus {
  SCHEDULED
  COMPLETED
  CANCELLED
  NO_SHOW
}

enum OauthProvider {
  GOOGLE
  GITHUB
}

enum ThemePreference {
  LIGHT
  DARK
  SYSTEM
}

enum LandingPagePreference {
  DASHBOARD
  APPLICATIONS
}

model User {
  id                    String                   @id @default(cuid())
  name                  String?
  email                 String                   @unique
  passwordHash          String?                  @map("password_hash")
  emailVerified         Boolean                  @default(false) @map("email_verified")
  emailVerifiedAt       DateTime?                @db.Timestamptz(3) @map("email_verified_at")
  theme                 ThemePreference          @default(SYSTEM)
  defaultLandingPage    LandingPagePreference    @default(DASHBOARD) @map("default_landing_page")
  timeZone              String                   @default("UTC") @map("time_zone")
  notificationsEnabled  Boolean                  @default(false) @map("notifications_enabled")
  createdAt             DateTime                 @default(now()) @db.Timestamptz(3) @map("created_at")
  updatedAt             DateTime                 @updatedAt @db.Timestamptz(3) @map("updated_at")

  oauthAccounts         OauthAccount[]
  refreshTokens         RefreshToken[]
  verificationTokens    EmailVerificationToken[]
  passwordResetTokens   PasswordResetToken[]
  applications          Application[]
  tags                  Tag[]

  @@map("users")
}

model OauthAccount {
  id                String      @id @default(cuid())
  userId            String      @map("user_id")
  provider          OauthProvider
  providerAccountId String      @map("provider_account_id")
  email             String?
  createdAt         DateTime    @default(now()) @db.Timestamptz(3) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@unique([userId, provider])
  @@index([userId])
  @@map("oauth_accounts")
}

model RefreshToken {
  id             String    @id @default(cuid())
  userId         String    @map("user_id")
  tokenHash      String    @unique @map("token_hash")
  expiresAt      DateTime  @db.Timestamptz(3) @map("expires_at")
  revokedAt      DateTime? @db.Timestamptz(3) @map("revoked_at")
  replacedByHash String?   @map("replaced_by_hash")
  userAgent      String?   @map("user_agent")
  ip             String?
  createdAt      DateTime  @default(now()) @db.Timestamptz(3) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@map("refresh_tokens")
}

model EmailVerificationToken {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  tokenHash String   @unique @map("token_hash")
  expiresAt DateTime @db.Timestamptz(3) @map("expires_at")
  createdAt DateTime @default(now()) @db.Timestamptz(3) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("email_verification_tokens")
}

model PasswordResetToken {
  id        String    @id @default(cuid())
  userId    String    @map("user_id")
  tokenHash String    @unique @map("token_hash")
  expiresAt DateTime  @db.Timestamptz(3) @map("expires_at")
  usedAt    DateTime? @db.Timestamptz(3) @map("used_at")
  createdAt DateTime  @default(now()) @db.Timestamptz(3) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("password_reset_tokens")
}

model Application {
  id              String            @id @default(cuid())
  userId          String            @map("user_id")
  company         String
  role            String
  jobUrl          String?           @map("job_url")
  location        String?
  remoteType      RemoteType?       @map("remote_type")
  employmentType  EmploymentType?   @map("employment_type")
  source          String?
  status          ApplicationStatus @default(WISHLIST)
  appliedAt       DateTime?         @db.Date @map("applied_at")
  salaryMin       Decimal?          @db.Decimal(12, 2) @map("salary_min")
  salaryMax       Decimal?          @db.Decimal(12, 2) @map("salary_max")
  currency        String?           @db.Char(3)
  nextFollowUpAt  DateTime?         @db.Timestamptz(3) @map("next_follow_up_at")
  archivedAt      DateTime?         @db.Timestamptz(3) @map("archived_at")
  createdAt       DateTime          @default(now()) @db.Timestamptz(3) @map("created_at")
  updatedAt       DateTime          @updatedAt @db.Timestamptz(3) @map("updated_at")

  user          User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  tags          ApplicationTag[]
  notes         Note[]
  interviews    Interview[]
  statusHistory StatusHistory[]

  @@index([userId])
  @@index([userId, status])
  @@index([userId, updatedAt])
  @@index([userId, nextFollowUpAt])
  @@index([userId, appliedAt])
  @@map("applications")
}

model Tag {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  name      String
  color     String?
  createdAt DateTime @default(now()) @db.Timestamptz(3) @map("created_at")

  user         User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  applications ApplicationTag[]

  @@unique([userId, name])
  @@index([userId])
  @@map("tags")
}

model ApplicationTag {
  applicationId String   @map("application_id")
  tagId         String   @map("tag_id")
  assignedAt    DateTime @default(now()) @db.Timestamptz(3) @map("assigned_at")

  application Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  tag         Tag         @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([applicationId, tagId])
  @@index([tagId])
  @@map("application_tags")
}

model Note {
  id            String   @id @default(cuid())
  applicationId String   @map("application_id")
  content       String
  createdAt     DateTime @default(now()) @db.Timestamptz(3) @map("created_at")
  updatedAt     DateTime @updatedAt @db.Timestamptz(3) @map("updated_at")

  application Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@index([applicationId])
  @@index([applicationId, createdAt])
  @@map("notes")
}

model Interview {
  id              String          @id @default(cuid())
  applicationId   String          @map("application_id")
  type            InterviewType
  scheduledAt     DateTime        @db.Timestamptz(3) @map("scheduled_at")
  interviewerName String?         @map("interviewer_name")
  meetingLink     String?         @map("meeting_link")
  location        String?
  notes           String?
  status          InterviewStatus @default(SCHEDULED)
  createdAt       DateTime        @default(now()) @db.Timestamptz(3) @map("created_at")
  updatedAt       DateTime        @updatedAt @db.Timestamptz(3) @map("updated_at")

  application Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@index([applicationId])
  @@index([applicationId, scheduledAt])
  @@map("interviews")
}

model StatusHistory {
  id            String            @id @default(cuid())
  applicationId String            @map("application_id")
  fromStatus    ApplicationStatus @map("from_status")
  toStatus      ApplicationStatus @map("to_status")
  note          String?
  changedAt     DateTime          @default(now()) @db.Timestamptz(3) @map("changed_at")

  application Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@index([applicationId])
  @@index([applicationId, changedAt])
  @@map("status_history")
}
```

---

## 9. Database Constraints

Some constraints are easier to add through custom SQL migrations.

Recommended constraints:

```sql
ALTER TABLE users
ADD CONSTRAINT users_email_verification_consistent
CHECK (
  (email_verified = TRUE AND email_verified_at IS NOT NULL)
  OR (email_verified = FALSE AND email_verified_at IS NULL)
);

ALTER TABLE applications
ADD CONSTRAINT applications_salary_min_nonnegative
CHECK (salary_min IS NULL OR salary_min >= 0);

ALTER TABLE applications
ADD CONSTRAINT applications_salary_max_nonnegative
CHECK (salary_max IS NULL OR salary_max >= 0);

ALTER TABLE applications
ADD CONSTRAINT applications_salary_range_valid
CHECK (
  salary_min IS NULL
  OR salary_max IS NULL
  OR salary_max >= salary_min
);

ALTER TABLE notes
ADD CONSTRAINT notes_content_length
CHECK (char_length(content) BETWEEN 1 AND 5000);

ALTER TABLE tags
ADD CONSTRAINT tags_name_length
CHECK (char_length(name) BETWEEN 1 AND 50);

ALTER TABLE applications
ADD CONSTRAINT applications_currency_format
CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$');

ALTER TABLE applications
ADD CONSTRAINT applications_salary_currency_required
CHECK (
  (salary_min IS NULL AND salary_max IS NULL)
  OR currency IS NOT NULL
);
```

Additional application-level validations must also be enforced by backend Zod schemas.

---

## 10. Indexing Strategy

## 10.1 Required Indexes

| Table                     | Index                                 | Purpose                        |
| ------------------------- | ------------------------------------- | ------------------------------ |
| users                     | unique email                          | Login lookup                   |
| oauth_accounts            | unique provider + provider_account_id | OAuth identity lookup          |
| refresh_tokens            | unique token_hash                     | Refresh validation             |
| email_verification_tokens | unique token_hash                     | Verification lookup            |
| password_reset_tokens     | unique token_hash                     | Reset lookup                   |
| applications              | user_id                               | User scoping                   |
| applications              | user_id + status                      | Status filtering               |
| applications              | user_id + updated_at                  | Recent sorting                 |
| applications              | user_id + next_follow_up_at           | Follow-up dashboard            |
| applications              | user_id + applied_at                  | Applied date filtering/sorting |
| tags                      | user_id + name unique                 | Tag lookup                     |
| application_tags          | tag_id                                | Tag deletion/listing           |
| notes                     | application_id + created_at           | Note listing                   |
| interviews                | application_id + scheduled_at         | Interview listing              |
| status_history            | application_id + changed_at           | History timeline               |

---

## 10.2 Optional Future Indexes

If data volume grows:

- PostgreSQL `pg_trgm` index for search on `company`, `role`, `location`
- Full-text search index for notes
- Partial index on active applications:

```sql
CREATE INDEX applications_user_active_idx
ON applications(user_id)
WHERE archived_at IS NULL;
```

---

## 11. Cascade Rules

## 11.1 User Deletion

When a user is deleted:

```txt
Delete oauth_accounts
Delete refresh_tokens
Delete email_verification_tokens
Delete password_reset_tokens
Delete tags
Delete applications
```

Applications deletion further deletes:

```txt
notes
interviews
status_history
application_tags
```

---

## 11.2 Application Deletion

When an application is deleted:

```txt
Delete notes
Delete interviews
Delete status_history
Delete application_tags
```

---

## 11.3 Tag Deletion

When a tag is deleted:

```txt
Delete related application_tags
```

Applications themselves are not deleted.

---

## 12. Soft Archive Strategy

Applications use soft archive:

```txt
archived_at = timestamp
```

Rules:

- Default queries should filter:

```txt
archived_at IS NULL
```

- Archived applications can be shown when `includeArchived=true`.
- Unarchive sets:

```txt
archived_at = NULL
```

Notes, interviews, and tags do not use soft delete in MVP.

---

## 13. Token Storage Rules

All sensitive tokens must be stored hashed.

Tokens to hash:

- Refresh token
- Email verification token
- Password reset token

Recommended hashing:

```txt
SHA-256 hex
```

Do not store raw tokens in database.

Example:

```txt
raw token: 8f2b...
stored: token_hash = sha256(raw token)
```

---

## 14. Email Normalization

Emails must be normalized before saving:

```txt
Trim whitespace
Convert to lowercase
```

Example:

```txt
"  John@Example.COM " -> "john@example.com"
```

This prevents duplicate accounts caused by case or whitespace differences.

---

## 15. Status History Rules

Status history is append-only.

Rules:

- No update endpoint.
- No delete endpoint except cascade via application deletion.
- Every status change creates a new row.
- Initial application creation with a non-default status creates the first
  history entry from `WISHLIST` to the selected status.

Required behavior:

```txt
If application is created with non-default status
  -> create history entry from WISHLIST to selected status
```

---

## 16. Data Ownership Rules

All primary resources are owned by a user.

User-owned tables:

```txt
applications
tags
```

Application-owned tables:

```txt
notes
interviews
status_history
application_tags
```

Every query from backend services should enforce ownership.

Example:

```sql
SELECT *
FROM applications
WHERE id = $1
  AND user_id = $2;
```

Do not fetch application by ID only without checking `user_id`.

---

## 17. Query Expectations

## 17.1 Applications List

Common filters:

```txt
user_id
status
archived_at
next_follow_up_at
applied_at
search
tags
sort
pagination
```

Recommended query pattern:

- Filter by `user_id`
- Exclude archived by default
- Join tags when needed
- Match note content with a scoped `EXISTS` relation so one application still
  produces one result row and pagination totals remain correct
- Paginate with limit/offset
- Sort using indexed columns
- Use a `CASE` expression for status pipeline rank rather than alphabetical enum
  order, and append `id` as a deterministic pagination tie-breaker

---

## 17.2 Dashboard Summary

Dashboard should use aggregate queries.

All dashboard queries exclude rows whose application has `archived_at IS NOT
NULL`. Active applications are limited to `APPLIED`, `SCREENING`, and
`INTERVIEW`. Scheduled interview counts require both `status = SCHEDULED` and
`scheduled_at >= now()`.

Examples:

- Total applications
- Active applications
- Offers
- Scheduled interviews
- Overdue follow-ups
- Today follow-ups
- Status counts

Recommended Prisma usage:

```txt
count()
groupBy()
findMany() with select
```

Avoid loading all applications into memory for dashboard calculations.

---

## 17.3 Upcoming Interviews

Query should:

- Join interview to application
- Filter application by current user
- Filter interview scheduled time >= now
- Sort by scheduled time ascending

---

## 17.4 Follow-up Queries

Overdue:

```txt
next_follow_up_at < now()
```

Today:

```txt
next_follow_up_at between start_of_today and end_of_today
```

Time zone handling:

- Store timestamps in UTC.
- Store an IANA `time_zone` preference on the user.
- Compute “today” boundaries from that zone, convert the boundaries to UTC, and
  use them in database predicates.
- Convert timestamps to user-local display values in the frontend.

---

## 18. Migration Strategy

Use Prisma Migrate for all schema changes.

## Local Development

```bash
docker compose up -d
pnpm prisma migrate dev
pnpm prisma db seed
```

## Production

```bash
prisma migrate deploy
```

Rules:

- Do not manually edit production schema.
- Do not use `prisma db push` in production.
- Every schema change must be represented by a migration.
- Migrations should be reviewed before deployment.
- Destructive migrations require explicit review.

---

## 19. Seed Strategy

Seed data should only be used in local and preview environments unless explicitly required.

Seed should create:

- Demo user
- Verified email
- Password
- Sample tags
- Sample applications
- Sample notes
- Sample interviews
- Sample status history

Recommended demo credentials:

```txt
email: demo@tally.local
password: password123
```

Seed must not run automatically in production.

---

## 20. Testing Database Strategy

Use a separate test database.

Example:

```txt
tally_test
```

CI pipeline should:

1. Start PostgreSQL service.
2. Set `DATABASE_URL` to test database.
3. Run migrations.
4. Run tests.
5. Tear down database.

Tests should isolate data using:

- Unique emails
- Transaction rollback where possible
- Table cleanup between integration tests

---

## 21. Backup and Recovery

Production database should support:

- Automated backups
- Point-in-time recovery where available
- Restore testing occasionally

Application-level backup:

- JSON export
- CSV export
- JSON import

Export/import does not replace database backups.

---

## 22. Security and Privacy

## 22.1 Sensitive Fields

Store hashed only:

```txt
password_hash
refresh_tokens.token_hash
email_verification_tokens.token_hash
password_reset_tokens.token_hash
```

Never store:

- Plaintext passwords
- Plaintext refresh tokens
- OAuth client secrets
- Email API keys
- Access tokens long-term

---

## 22.2 Connection Security

Production database should:

- Require TLS/SSL where available
- Use environment-specific credentials
- Restrict access to backend service
- Avoid public exposure

---

## 22.3 Least Privilege

The application runtime database user should have only required DML
permissions:

```txt
SELECT
INSERT
UPDATE
DELETE
```

Do not use superuser credentials for application runtime.

Schema migrations run as a separate deployment step with a migration credential
that has the required DDL permissions. Production exposes that credential as
`MIGRATION_DATABASE_URL` only to the migration job; local/CI may fall back to
`DATABASE_URL`.

---

## 23. Performance Considerations

For MVP:

- Use pagination.
- Avoid N+1 queries.
- Use Prisma `select` to fetch only required fields.
- Use indexes for common filters.
- Aggregate dashboard stats in database where possible.

Future optimization if needed:

- Keyset pagination instead of offset pagination
- Materialized dashboard stats
- Full-text search
- Read replicas
- Caching layer

---

## 24. Database Acceptance Criteria

The database layer is complete when:

- PostgreSQL schema is defined in Prisma.
- All enums are defined.
- Physical columns use the documented snake_case mappings and temporal fields
  use explicit `Timestamptz`/`Date` native types.
- All relationships are enforced with foreign keys.
- All cascade rules work.
- All required indexes exist.
- Email is unique and normalized.
- OAuth accounts are unique per provider.
- A user has at most one linked account for each provider.
- Tokens are stored hashed.
- Passwords are stored hashed.
- User preferences are stored.
- User time zone is stored and validated at the API boundary.
- Applications support soft archive.
- Status history is immutable and linked to applications.
- Tags are unique per user.
- Application tags are unique per application/tag pair.
- Notes and interviews cascade delete correctly.
- Prisma migrations run cleanly.
- Seed script works in development.
- Test database works in CI.
- Dashboard aggregate queries perform efficiently on sample data.
- Production migration strategy is documented.
