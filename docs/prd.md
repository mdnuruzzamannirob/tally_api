# Product Requirements Document

## Job Application Tracker

**Version:** 1.1
**Status:** Final for MVP
**Product Type:** Full-stack Web Application + Progressive Web App
**Primary Stack Constraints:** Next.js, TypeScript, Express TypeScript backend, RTK Query, PostgreSQL, PWA

---

## 1. Executive Summary

Job Application Tracker is a full-stack, installable web application designed to help job seekers manage their job search process in one place. Users can track applications, statuses, follow-ups, notes, tags, interviews, and profile settings securely.

The product will include a modern authentication system with email/password registration, email verification, social login through Google and GitHub, forgot password, reset password, and change password functionality. The application will be built as a Progressive Web App and deployed as a complete full-stack project.

The MVP is intentionally scoped to be portfolio-grade and production-quality without becoming overly complex.

---

## 2. Product Vision

Provide job seekers with a clean, secure, and reliable application where they can manage their entire job search pipeline.

The product should feel:

- Simple
- Fast
- Secure
- Mobile-friendly
- Installable
- Professional
- Easy to maintain

---

## 3. Problem Statement

Job seekers often apply to multiple companies through different platforms. As a result, their job search becomes fragmented and difficult to manage.

Common problems include:

- Losing track of companies and roles applied to
- Forgetting application statuses
- Missing follow-up opportunities
- Managing interview schedules across multiple tools
- Storing notes, sources, and reminders in scattered places
- Using spreadsheets that lack a smooth user experience
- Having no centralized personal dashboard for job search progress

Job Application Tracker solves this by providing a single secure workspace for managing all job applications.

---

## 4. Goals and Objectives

### Product Goals

1. Allow users to securely register, verify, and authenticate.
2. Enable users to create and manage job applications efficiently.
3. Provide a clear application pipeline with status tracking.
4. Help users avoid missing follow-ups and interviews.
5. Support note-taking, tagging, and interview scheduling.
6. Provide a dashboard that summarizes job search progress.
7. Deliver a polished, installable PWA experience.
8. Demonstrate strong full-stack engineering quality.

### Business/Portfolio Objectives

1. Showcase full-stack development skills.
2. Demonstrate secure authentication implementation.
3. Demonstrate clean architecture and maintainable code.
4. Demonstrate frontend/backend/database/DevOps integration.
5. Provide a live, deployable project suitable for a resume or portfolio.

---

## 5. Target Users

## 5.1 Primary User: Job Seeker

A person actively applying for jobs, internships, contracts, or full-time roles.

### Characteristics

- Applies to multiple companies
- Uses both mobile and desktop devices
- Needs quick data entry
- Wants reminders and follow-up tracking
- May prefer social login over password management

### Needs

- Track applications
- Manage statuses
- Add notes and tags
- Schedule interviews
- Set follow-up dates
- Export data
- Use a secure account

---

## 5.2 Secondary User: Career Coach or Mentor

A person reviewing a job seeker’s progress.

### Needs

- Understand application pipeline
- Review exported data
- Identify follow-up gaps

---

## 6. Personas

## Persona 1: Recent Graduate

A new graduate applying to many entry-level positions.

### Pain Points

- Forgets where they applied
- Misses recruiter follow-ups
- Does not have a structured process

### Needs

- Quick application creation
- Simple dashboard
- Follow-up reminders

---

## Persona 2: Experienced Professional

A mid-level professional applying selectively to target companies.

### Pain Points

- Needs detailed tracking
- Has multiple interview rounds
- Wants to store interview notes

### Needs

- Status pipeline
- Interview tracking
- Tags and notes
- Exportable data

---

## Persona 3: Social Login User

A user who prefers not to manage another password.

### Pain Points

- Does not want to remember credentials
- Wants fast onboarding

### Needs

- Google or GitHub login
- Optional password setup later
- Secure account management

---

## 7. Product Principles

The product should follow these principles:

1. **Simplicity**
   The core workflow should be easy to understand and use.

2. **Security**
   Authentication and account recovery must be implemented carefully.

3. **Data Ownership**
   Users should be able to export and manage their own data.

4. **Mobile-first Usability**
   The application must work well on small screens.

5. **Portfolio-grade Quality**
   The project should demonstrate professional engineering practices.

6. **Controlled Scope**
   The MVP should avoid unnecessary complexity while remaining impressive.

---

## 8. Scope

## 8.1 In Scope

The MVP will include the following areas:

### Authentication and Account Management

- Email/password registration
- Email verification on registration
- Login
- Logout
- Forgot password
- Reset password
- Change password
- Set password for OAuth-only users
- Google OAuth login
- GitHub OAuth login
- Connected account management
- Protected routes
- Session management

### Job Application Management

- Create application
- Edit application
- Delete application
- Archive/unarchive application
- Application detail view
- Status pipeline
- Status history
- Search
- Filtering
- Sorting
- Pagination

### Tags

- Create tag
- Edit tag
- Delete tag
- Assign tags to applications
- Remove tags from applications

### Notes

- Add note to application
- Edit note
- Delete note

### Interviews

- Add interview
- Edit interview
- Delete interview
- Interview type
- Interview status
- Interview schedule
- Interview notes
- Upcoming interviews list

### Dashboard

- Total applications
- Active applications
- Scheduled interviews
- Offers
- Overdue follow-ups
- Today’s follow-ups
- Status distribution chart
- Recent applications
- Upcoming interviews

### Settings

- Profile information
- Password management
- Connected social accounts
- Theme preference
- Default landing page
- Time zone
- Export data
- Import data
- Notification preference, optional

### Progressive Web App

- Installable application
- Manifest file
- App icons
- Service worker
- Offline fallback
- Cached app shell
- Offline banner
- Basic offline data visibility, where practical

### Data Backup

- JSON export
- CSV export
- JSON import

---

## 8.2 Out of Scope for MVP

The following features are excluded from the MVP:

- Team collaboration
- Admin dashboard
- Job board scraping
- LinkedIn import
- Resume file upload
- Cover letter generation
- AI features
- Payment integration
- Real-time chat
- Email sending to recruiters
- Calendar synchronization
- Push notification server
- Native mobile application
- Multi-language support beyond basic English UI

---

## 9. Functional Requirements

## 9.1 Authentication and Account Management

### FR-AUTH-01: Email Registration

The system shall allow users to register with name, email, and password.

#### Requirements

- Name, email, and password are required.
- Name must contain 1–100 characters after trimming.
- Email must be unique.
- Password must be at least 8 characters.
- Password must not exceed 72 UTF-8 bytes because bcrypt truncates longer input.
- Password must be hashed before storage.
- A newly registered user shall have an unverified email status.
- The system shall send a verification email after registration.

---

### FR-AUTH-02: Email Verification

The system shall require email verification for email/password users.

#### Requirements

- Verification email shall contain a secure tokenized link.
- Verification token shall be stored securely and hashed.
- Verification token shall have an expiration time.
- Users with unverified emails shall not receive full access to protected application areas.
- The system shall provide a resend verification email option.
- Resend actions shall be rate-limited.

---

### FR-AUTH-03: Login

The system shall allow verified users to log in using email and password.

#### Requirements

- Login requires email and password.
- Password must be validated against stored hash.
- Invalid credentials shall show a generic error message.
- Unverified users shall be shown a verification prompt.
- Successful login shall create a secure session.

---

### FR-AUTH-04: Social Login

The system shall support social authentication using Google and GitHub.

#### Requirements

- Users shall be able to sign in with Google OAuth.
- Users shall be able to sign in with GitHub OAuth.
- OAuth state validation shall be implemented.
- If no account exists, the system shall create a new user account.
- OAuth users shall be considered email-verified.
- If an OAuth provider returns a verified email that already exists, the system shall link the OAuth identity to the existing account.
- If email verification from the provider cannot be confirmed, the system shall prevent automatic account linking and show a safe error or guidance message.
- Users shall be able to manage linked providers in Settings.

---

### FR-AUTH-05: Forgot Password

The system shall allow users to request a password reset.

#### Requirements

- User shall submit an email address.
- If the email exists, the system shall send a password reset email.
- The response shall not reveal whether the email exists.
- Password reset token shall be hashed and single-use.
- Password reset token shall expire within a short time window.
- Reset requests shall be rate-limited.

---

### FR-AUTH-06: Reset Password

The system shall allow users to set a new password using a valid reset token.

#### Requirements

- Reset page shall validate the token.
- Expired or invalid tokens shall show an appropriate error.
- New password must satisfy password policy.
- Password confirmation shall be required.
- After successful reset, previous sessions shall be invalidated where possible.
- Reset token shall be invalidated after use.

---

### FR-AUTH-07: Change Password

The system shall allow logged-in users to change their password.

#### Requirements

- If the user already has a password, current password shall be required.
- New password and confirmation shall be required.
- Password policy shall be enforced.
- Successful change shall update the stored password hash.
- User shall receive a success message.

---

### FR-AUTH-08: Set Password for OAuth-only Users

The system shall allow OAuth-only users to set a password.

#### Requirements

- OAuth-only users shall see a “Set Password” option in Settings.
- Current password shall not be required because the user is already authenticated.
- New password and confirmation shall be required.
- After setting a password, the user shall be able to log in with email/password as well as OAuth.

---

### FR-AUTH-09: Connected Account Management

The system shall allow users to manage linked OAuth providers.

#### Requirements

- Settings shall show connected providers.
- Users shall be able to link Google and/or GitHub accounts.
- Users shall be able to unlink providers.
- The system shall prevent unlinking if no active login method would remain.
- Security warnings shall be shown before destructive actions.

---

### FR-AUTH-10: Logout

The system shall allow users to log out securely.

#### Requirements

- Logout shall terminate the active session.
- Refresh tokens or session artifacts shall be revoked where applicable.
- User shall be redirected to the login screen or public landing page.

---

## 9.2 Job Application Management

### FR-APP-01: Create Application

The system shall allow authenticated users to create job applications.

#### Required Fields

- Company
- Role

#### Optional Fields

- Job URL
- Location
- Remote type
- Employment type
- Source
- Status
- Applied date
- Salary minimum
- Salary maximum
- Currency
- Follow-up date/time
- Tags
- Initial note

#### Rules

- Company and Role are mandatory.
- Application data shall belong to the authenticated user.
- Created and updated timestamps shall be stored.
- When tags, an initial note, or a non-default status are supplied, the
  application and related records shall be created atomically.
- A non-default initial status creates history from `Wishlist` to that status.
- Currency is required when either salary value is provided.

---

### FR-APP-02: Edit Application

The system shall allow users to edit their own applications.

#### Requirements

- Existing data shall be pre-filled.
- Validation rules shall match creation rules.
- Updated timestamp shall change after modification.

---

### FR-APP-03: Delete Application

The system shall allow users to delete their own applications.

#### Requirements

- Deletion shall require confirmation.
- Related child data may be deleted according to database rules.
- Success feedback shall be shown.

---

### FR-APP-04: Archive Application

The system shall allow users to archive applications.

#### Requirements

- Archived applications shall be hidden from default views.
- Users shall be able to filter archived applications.
- Users shall be able to unarchive applications.

---

### FR-APP-05: Application Status Pipeline

The system shall support the following statuses:

- Wishlist
- Applied
- Screening
- Interview
- Offer
- Rejected
- Withdrawn

#### Rules

- Default status shall be Wishlist.
- Users shall be able to change status.
- Every status change shall create a status history entry.
- Optional note may be attached to a status change.

---

### FR-APP-06: Status History

The system shall record status changes.

#### Data Captured

- Previous status
- New status
- Timestamp
- Optional note

---

### FR-APP-07: Follow-up Tracking

The system shall allow users to set a follow-up date/time.

#### Requirements

- Follow-up date/time shall be optional, entered in the user's time zone, and
  normalized to UTC at the API boundary.
- Overdue follow-ups shall be visually highlighted.
- Follow-ups due today shall be visually highlighted.
- Dashboard shall show due and overdue follow-ups.

---

## 9.3 Search, Filter, and Sort

### FR-SEARCH-01: Search

The system shall allow users to search applications.

#### Searchable Fields

- Company
- Role
- Location
- Tags
- Notes

Search must use the same scope in every application view. Note-content matching
may use a relational `EXISTS` query for MVP; full-text indexing is not required
until data volume justifies it.

---

### FR-FILTER-01: Filtering

The system shall allow filtering by:

- Status
- Tags
- Remote type
- Employment type
- Source
- Applied date range
- Follow-up state
- Archived inclusion

---

### FR-SORT-01: Sorting

The system shall allow sorting by:

- Recently updated
- Recently created
- Company name
- Role name
- Applied date
- Follow-up date
- Status

---

## 9.4 Notes

### FR-NOTE-01: Add Note

The system shall allow users to add notes to an application.

#### Requirements

- Note content is required.
- Empty notes shall not be saved.
- Notes shall include timestamps.

---

### FR-NOTE-02: Edit and Delete Note

The system shall allow users to edit and delete their own notes.

#### Requirements

- Updated timestamp shall be stored.
- Deletion shall require confirmation.

---

## 9.5 Tags

### FR-TAG-01: Create and Manage Tags

The system shall allow users to create, edit, and delete tags.

#### Rules

- Tag name shall be unique per user.
- Tag names are trimmed and normalized to lowercase before uniqueness checks.
- Tags shall be reusable across applications.

---

### FR-TAG-02: Assign Tags to Applications

The system shall allow multiple tags per application.

#### Requirements

- Users can assign existing tags.
- Users can remove tags from applications.
- Tags shall be usable in filters.

---

## 9.6 Interviews

### FR-INT-01: Create Interview

The system shall allow users to create interviews linked to an application.

#### Fields

- Interview type
- Scheduled date/time
- Interviewer name
- Meeting link
- Location
- Notes
- Interview status

#### Interview Types

- Phone
- Technical
- HR
- System Design
- Onsite
- Other

#### Interview Statuses

- Scheduled
- Completed
- Cancelled
- No-show

---

### FR-INT-02: View Upcoming Interviews

The system shall show upcoming interviews.

#### Requirements

- Dashboard shall show upcoming interviews.
- Application detail page shall show related interviews.

---

## 9.7 Dashboard

### FR-DASH-01: Dashboard Summary

The system shall provide a dashboard for authenticated users.

#### Widgets

- Total applications
- Active applications
- Scheduled interviews
- Offers
- Overdue follow-ups
- Today’s follow-ups
- Status distribution
- Recent applications
- Upcoming interviews

#### Metric Rules

- Dashboard totals, status distribution, follow-ups, recent applications, and
  interview widgets exclude archived applications.
- Active applications are applications in `Applied`, `Screening`, or
  `Interview` status.
- Scheduled interviews count only future interviews with `Scheduled` status
  whose application is not archived.
- “Today” and “overdue” follow-up boundaries use the user's stored IANA time
  zone; timestamps are exchanged and stored in UTC.

---

## 9.8 Settings

### FR-SET-01: Profile Settings

The system shall allow users to update profile information.

#### Editable Fields

- Name

#### Read-only Fields

- Email

---

### FR-SET-02: Password Settings

The system shall allow password management.

#### Requirements

- Users with passwords can change password.
- OAuth-only users can set password.

---

### FR-SET-03: Connected Accounts

The system shall allow management of Google and GitHub connections.

---

### FR-SET-04: Preferences

The system shall allow users to configure:

- Theme
- Default landing page
- Time zone as an IANA identifier, for example `Asia/Dhaka`
- Notification preference, optional

For authenticated users, server-stored preferences are authoritative. A local
theme value may be used only as an early-render cache to avoid a flash before
the authenticated preference is loaded.

---

### FR-SET-05: Data Export and Import

The system shall allow data portability.

#### Requirements

- Export all data as JSON.
- Export applications as CSV.
- Import JSON backup.
- Import shall validate structure.
- Destructive import actions shall require confirmation.

---

## 9.9 Progressive Web App Requirements

### FR-PWA-01: Installability

The application shall be installable on supported browsers.

#### Requirements

- Valid web app manifest
- App name and short name
- Icons, including maskable icon where possible
- Standalone display mode
- Theme color

---

### FR-PWA-02: Offline Support

The application shall provide basic offline support.

#### Requirements

- Service worker shall cache the app shell.
- Offline fallback page shall be available.
- Offline banner shall be shown when network is unavailable.
- Cached data may be displayed in read-only mode where practical.

---

## 10. User Stories and Acceptance Criteria

## 10.1 Authentication User Stories

### US-AUTH-01: Register with Email

**As a** new user
**I want to** register with email and password
**So that** I can create a personal job tracking account

#### Acceptance Criteria

- User can submit name, email, and password.
- Account is created in an unverified state.
- Verification email is sent.
- User is informed to check email.

---

### US-AUTH-02: Verify Email

**As a** registered user
**I want to** verify my email
**So that** I can access the application

#### Acceptance Criteria

- Valid verification link marks email as verified.
- Invalid or expired token shows an error.
- Verified user can access protected areas.
- Verification does not create a session; the user is directed to sign in.

---

### US-AUTH-03: Login with Email and Password

**As a** verified user
**I want to** log in with email and password
**So that** I can access my data

#### Acceptance Criteria

- Valid credentials create a session.
- Invalid credentials show a generic error.
- Unverified users are guided to verify email.

---

### US-AUTH-04: Social Login

**As a** user
**I want to** log in with Google or GitHub
**So that** I can access the app quickly

#### Acceptance Criteria

- Google OAuth login works.
- GitHub OAuth login works.
- New users are created when no account exists.
- Existing verified email accounts are linked safely.
- OAuth users are considered verified.

---

### US-AUTH-05: Forgot Password

**As a** user
**I want to** request a password reset
**So that** I can recover access to my account

#### Acceptance Criteria

- User can submit email.
- Reset email is sent if account exists.
- Response does not reveal whether email exists.
- Token expires and is single-use.

---

### US-AUTH-06: Reset Password

**As a** user
**I want to** reset my password using a secure link
**So that** I can regain access

#### Acceptance Criteria

- Valid token allows password reset.
- Invalid or expired token shows an error.
- New password is saved securely.
- Previous sessions are invalidated where possible.

---

### US-AUTH-07: Change Password

**As a** logged-in user
**I want to** change my password
**So that** I can keep my account secure

#### Acceptance Criteria

- Current password is required if user has one.
- New password and confirmation are validated.
- Password is updated successfully.
- Success message is shown.

---

### US-AUTH-08: Set Password for OAuth-only User

**As an** OAuth-only user
**I want to** set a password
**So that** I can also log in with email and password

#### Acceptance Criteria

- Logged-in OAuth-only user can set a password.
- Current password is not required.
- Password is saved securely.
- Email/password login becomes available.

---

### US-AUTH-09: Manage Connected Accounts

**As a** user
**I want to** manage linked Google and GitHub accounts
**So that** I can control my login methods

#### Acceptance Criteria

- Connected providers are visible.
- User can link or unlink providers.
- System prevents removing the last login method.
- Warning is shown before unlinking.

---

## 10.2 Application User Stories

### US-APP-01: Create Application

**As a** user
**I want to** add a job application
**So that** I can track where I applied

#### Acceptance Criteria

- Company and role are required.
- Optional fields can be provided.
- Application is saved to the user’s account.
- User sees confirmation.

---

### US-APP-02: Edit Application

**As a** user
**I want to** edit application details
**So that** I can keep information up to date

#### Acceptance Criteria

- Existing values are pre-filled.
- Validation rules apply.
- Changes are saved successfully.

---

### US-APP-03: Delete Application

**As a** user
**I want to** delete an application
**So that** I can remove records I no longer need

#### Acceptance Criteria

- Confirmation is required.
- Application is removed after confirmation.
- Related data is handled consistently.

---

### US-APP-04: Change Status

**As a** user
**I want to** update an application status
**So that** I can track progress

#### Acceptance Criteria

- Status can be changed from list and detail; it can also be changed from the
  board when that Should Have enhancement is enabled.
- Status history is recorded.
- Optional note can be added.

---

### US-APP-05: Search, Filter, and Sort

**As a** user
**I want to** search, filter, and sort applications
**So that** I can find relevant records quickly

#### Acceptance Criteria

- Search returns relevant results.
- Filters can be combined.
- Sorting updates list order.
- Empty state is shown when no results exist.

---

## 10.3 Notes, Tags, and Interviews User Stories

### US-NOTE-01: Add Note

**As a** user
**I want to** add a note to an application
**So that** I can remember important details

#### Acceptance Criteria

- Note content is required.
- Note is saved with timestamp.
- Note appears in application detail.

---

### US-TAG-01: Use Tags

**As a** user
**I want to** tag applications
**So that** I can categorize them

#### Acceptance Criteria

- Tags can be created.
- Tags can be assigned to applications.
- Tags can be used in filters.

---

### US-INT-01: Add Interview

**As a** user
**I want to** add an interview
**So that** I can manage my schedule

#### Acceptance Criteria

- Interview is linked to an application.
- Date/time is required.
- Interview type and status are supported.
- Upcoming interviews are visible.

---

## 10.4 Dashboard and Settings User Stories

### US-DASH-01: View Dashboard

**As a** user
**I want to** see a summary dashboard
**So that** I can understand my job search progress

#### Acceptance Criteria

- Dashboard shows key metrics.
- Overdue follow-ups are highlighted.
- Upcoming interviews are visible.
- Data reflects current user only.

---

### US-SET-01: Manage Account Settings

**As a** user
**I want to** manage account settings
**So that** I can control profile, password, and data

#### Acceptance Criteria

- Profile can be updated.
- Password can be changed or set.
- Connected accounts can be managed.
- Data can be exported or imported.
- Default landing page and time zone can be updated.

---

## 11. Key User Flows

## 11.1 Email Registration Flow

```text
User opens registration page
  -> Enters name, email, and password
  -> Submits form
  -> System creates unverified account
  -> System sends verification email
  -> User clicks verification link
  -> Email is verified
  -> User gains access to protected application
```

---

## 11.2 Email Login Flow

```text
User opens login page
  -> Enters email and password
  -> System validates credentials
  -> If unverified, system shows verification prompt
  -> If verified, system creates session
  -> User is redirected to the intended protected route when present
  -> Otherwise user is redirected to the saved default landing page
```

---

## 11.3 Social Login Flow

```text
User selects Google or GitHub login
  -> Redirected to OAuth provider
  -> User authorizes application
  -> Provider redirects to callback
  -> System validates OAuth response
  -> System creates or links account
  -> System creates session
  -> User is redirected through the frontend social callback
  -> Frontend uses the intended route or saved default landing page
```

---

## 11.4 Forgot Password Flow

```text
User opens forgot password page
  -> Enters email
  -> System checks account
  -> If account exists, system sends reset email
  -> User opens reset link
  -> User enters new password
  -> System validates token and password
  -> Password is updated
  -> Previous sessions are invalidated
```

---

## 11.5 Change Password Flow

```text
Logged-in user opens Settings
  -> Navigates to Password section
  -> Enters current password if required
  -> Enters new password and confirmation
  -> System validates input
  -> Password is updated
  -> Success message is shown
```

---

## 11.6 OAuth-only Set Password Flow

```text
OAuth-only user opens Settings
  -> Navigates to Password section
  -> Selects Set Password
  -> Enters new password and confirmation
  -> System saves password
  -> User can now log in with email/password
```

---

## 11.7 Application Creation Flow

```text
User clicks Add Application
  -> Enters company and role
  -> Optionally adds more details
  -> Submits form
  -> System validates data
  -> Application is saved
  -> UI updates list/dashboard
```

---

## 11.8 Status Change Flow

```text
User changes status from list/detail, or from the optional board
  -> User optionally adds a status note
  -> System updates application status
  -> System creates status history entry
  -> UI reflects updated status
```

---

## 11.9 Export/Import Flow

```text
User opens Settings
  -> Selects Export JSON or CSV
  -> File is downloaded

User opens Settings
  -> Selects Import JSON
  -> Chooses file
  -> System validates file
  -> User confirms import
  -> Data is imported
```

---

## 12. Screen Inventory

## Public Screens

1. Login
2. Register
3. Forgot Password
4. Reset Password
5. Email Verification Result

## Protected Screens

1. Dashboard
2. Applications List
3. Application Detail
4. Interviews
5. Settings

## Shared UI Components

- Navigation bar
- Sidebar or top navigation
- Forms
- Modals
- Tables/cards
- Badges
- Tags
- Date pickers
- Charts
- Empty states
- Loading skeletons
- Error banners
- Toast notifications
- Offline banner

---

## 13. Non-Functional Requirements

## 13.1 Security

The system shall:

- Hash passwords using a strong algorithm such as bcrypt.
- Store verification and reset tokens securely.
- Enforce token expiration.
- Rate-limit authentication endpoints.
- Validate OAuth state.
- Use secure session management.
- Use HTTP-only cookies where applicable.
- Enforce CORS policies.
- Validate all input.
- Prevent users from accessing other users’ data.
- Avoid logging sensitive information.

---

## 13.2 Privacy

The system shall:

- Isolate data by user.
- Allow users to export their data.
- Avoid unnecessary data collection.
- Use transactional email only for account-related communication.

---

## 13.3 Performance

The system should:

- Load core pages quickly.
- Paginate application lists.
- Avoid unnecessary API calls.
- Use caching where appropriate.
- Optimize dashboard queries.
- Target strong Lighthouse scores where practical.

---

## 13.4 Accessibility

The system shall:

- Support keyboard navigation.
- Use semantic HTML.
- Provide accessible form labels.
- Show visible focus states.
- Associate error messages with fields.
- Maintain sufficient color contrast.

---

## 13.5 Responsiveness

The system shall support:

- Mobile devices
- Tablets
- Desktop screens

The UI should follow a mobile-first approach.

---

## 13.6 Reliability

The system shall:

- Handle API errors gracefully.
- Show loading states.
- Show empty states.
- Show error states.
- Provide a backend health endpoint.
- Display offline status where applicable.

---

## 13.7 Maintainability

The codebase shall:

- Use TypeScript on frontend and backend.
- Follow a modular structure.
- Separate concerns between UI, API, services, and data access.
- Use reusable components.
- Support automated testing.
- Support linting and formatting.

---

## 14. Technical Constraints and Platform Decisions

The following technical constraints are confirmed for this project.

| Area                | Requirement                                 |
| ------------------- | ------------------------------------------- |
| Frontend Framework  | Next.js                                     |
| Frontend Language   | TypeScript                                  |
| Backend Framework   | Express                                     |
| Backend Language    | TypeScript                                  |
| API Data Fetching   | RTK Query                                   |
| Database            | PostgreSQL                                  |
| ORM                 | Prisma recommended                          |
| Authentication      | Email/password plus Google and GitHub OAuth |
| Email Verification  | Required for email/password registration    |
| Password Recovery   | Forgot and reset password required          |
| Password Management | Change password and set password required   |
| App Type            | Responsive web app and installable PWA      |
| Deployment          | Cloud deployment required                   |
| Backend Deployment  | Separate backend service                    |
| CI/CD               | Required                                    |

---

## 15. Dependencies

## 15.1 Email Provider

An email provider is required for:

- Email verification
- Password reset

Possible providers:

- Resend
- SendGrid
- Mailgun
- SMTP service

---

## 15.2 OAuth Providers

OAuth credentials are required for:

- Google OAuth
- GitHub OAuth

---

## 15.3 Database Hosting

A managed PostgreSQL provider is required.

Possible providers:

- Neon
- Supabase
- Render PostgreSQL
- Railway PostgreSQL

---

## 15.4 Application Hosting

Frontend and backend must be deployed separately.

Recommended deployment model:

| Layer    | Suggested Provider                                       |
| -------- | -------------------------------------------------------- |
| Frontend | Vercel                                                   |
| Backend  | Render, Railway, or Fly                                  |
| Database | Neon, Supabase, Render PostgreSQL, or Railway PostgreSQL |

---

## 16. Priority Classification

## Must Have

- Email/password registration
- Email verification
- Login/logout
- Google OAuth login
- GitHub OAuth login
- Forgot password
- Reset password
- Change password
- Set password for OAuth-only users
- Connected account management
- Application CRUD
- Status pipeline
- Status history
- Search/filter/sort
- Tags
- Notes
- Interviews
- Dashboard
- Settings
- JSON/CSV export
- JSON import
- PWA installability
- Responsive design
- Protected routes
- CSRF protection for cookie-authenticated endpoints
- Health check endpoint
- CI/CD pipeline
- Deployment

---

## Should Have

- Kanban drag-and-drop
- Offline cached data read-only view
- Notification preferences
- Activity timeline
- Additional CSRF hardening beyond the required allowed-origin check
- Audit logging
- Demo account
- Redis-based or managed rate limiting

---

## Could Have

- Delete account
- Change email
- Calendar view
- Public share link
- Keyboard shortcuts
- Offline mutation queue
- Advanced analytics

---

## Won’t Have in MVP

- Admin dashboard
- Team collaboration
- Job scraping
- LinkedIn import
- AI-generated content
- Payment system
- Native mobile app
- Real-time chat
- Email sending to recruiters

---

## 17. Success Metrics

## Product Success Metrics

- Users can register and verify email successfully.
- Users can log in using email/password and OAuth.
- Users can recover and change passwords.
- Users can create, update, and track applications.
- Users can add notes, tags, and interviews.
- Users can export and import data.
- Application is installable as a PWA.

## Engineering Success Metrics

- Frontend is deployed and accessible.
- Backend API is deployed and healthy.
- Database migrations are applied successfully.
- Automated tests pass.
- CI pipeline passes.
- Authentication flows work end-to-end.
- No critical security or data-access defects exist.
- README and setup instructions are complete.

## UX Success Metrics

- Application creation flow is simple.
- Dashboard is easy to understand.
- Authentication errors are clear and safe.
- Mobile layout is usable.
- Empty, loading, and error states are handled.

---

## 18. Risks and Mitigations

| Risk                               | Impact | Mitigation                                                              |
| ---------------------------------- | ------ | ----------------------------------------------------------------------- |
| Email delivery issues              | High   | Use a reliable email provider and test deliverability                   |
| OAuth callback complexity          | High   | Implement secure state validation and clear error handling              |
| Cross-origin authentication issues | High   | Use proper CORS, secure cookies, and environment-specific configuration |
| Password reset security risks      | High   | Use hashed, single-use, short-lived tokens                              |
| Account linking edge cases         | Medium | Define safe rules for verified OAuth emails and existing accounts       |
| Scope creep                        | Medium | Strictly follow MVP scope                                               |
| PWA offline complexity             | Medium | Limit MVP offline support to app shell and cached read-only data        |
| Third-party secret management      | Medium | Store secrets in environment variables and deployment secrets           |

---

## 19. Release Criteria / Definition of Done

The MVP shall be considered complete when the following conditions are met.

## Authentication

- Registration works.
- Email verification works.
- Login works.
- Google OAuth works.
- GitHub OAuth works.
- Forgot password works.
- Reset password works.
- Change password works.
- OAuth-only set password works.
- Connected account management works.
- Logout works.
- Protected routes are enforced.

## Core Features

- Application CRUD works.
- Status changes work.
- Status history works.
- Tags work.
- Notes work.
- Interviews work.
- Search/filter/sort works.
- Dashboard works.
- Export/import works.

## PWA

- App is installable.
- Manifest and icons are valid.
- Service worker is active.
- Offline fallback works.
- Offline banner works.

## Engineering

- Frontend is built with Next.js and TypeScript.
- Backend is built with Express and TypeScript.
- RTK Query is used for API data fetching.
- Database migrations are clean.
- Health check endpoint works.
- Tests pass.
- CI pipeline passes.
- Application is deployed.
- README is complete.

---

## 20. Future Enhancements

Potential features for future releases include:

- Delete account
- Change email
- Advanced notification system
- Calendar integration
- Resume version tracking
- Cover letter snippets
- Public portfolio share link
- Job board integration
- AI-assisted application notes
- Offline mutation queue and background sync
- Multi-language support
- Admin analytics dashboard
