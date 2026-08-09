# Definition of Done / Testing Checklist

## Job Application Tracker

**Version:** 1.0
**Status:** Final for MVP
**Related Documents:**

- Product Requirements Document v1.1
- UI/UX Specification v1.1
- Frontend Specification v1.0
- Backend Specification v1.0
- Database Specification v1.0
- Operations Specification v1.0

---

## 1. Purpose

This document defines when Job Application Tracker is considered complete for MVP release.

It includes:

- Definition of Done
- Functional testing checklist
- UI/UX testing checklist
- Frontend testing checklist
- Backend testing checklist
- Database testing checklist
- PWA testing checklist
- Security testing checklist
- Accessibility testing checklist
- Performance testing checklist
- Automated testing checklist
- Deployment checklist
- Release sign-off criteria

This checklist should be used before marking the project as MVP-complete.

---

## 2. Completion Levels

## 2.1 Feature Done

A feature is done when:

- Requirements are implemented.
- UI matches specification.
- Validation works.
- Error handling works.
- Tests are added.
- No known critical bugs.
- Code is reviewed and merged.

---

## 2.2 MVP Release Candidate

MVP release candidate is ready when:

- All Must Have features are complete.
- All critical user flows pass.
- CI passes.
- Production environment is configured.
- Security checks pass.
- PWA checks pass.
- Deployment checklist is completed.

---

## 2.3 Production Release

Production release is approved when:

- Release candidate passes regression testing.
- Production deployment succeeds.
- Health checks pass.
- Post-deployment smoke test passes.
- No critical or high-severity release blockers remain.
- Rollback plan is available.

---

# 3. Definition of Done

## 3.1 Product Definition of Done

- [ ] User can register with email/password.
- [ ] User can verify email.
- [ ] User can log in.
- [ ] User can log out.
- [ ] User can use Google OAuth.
- [ ] User can use GitHub OAuth.
- [ ] User can request forgot password.
- [ ] User can reset password.
- [ ] User can change password.
- [ ] OAuth-only user can set password.
- [ ] User can manage connected accounts.
- [ ] User can create applications.
- [ ] User can edit applications.
- [ ] User can delete applications.
- [ ] User can archive/unarchive applications.
- [ ] User can change application status.
- [ ] User can view status history.
- [ ] User can create, edit, delete, assign, and remove tags.
- [ ] User can add notes.
- [ ] User can add interviews.
- [ ] User can search applications.
- [ ] User can filter applications.
- [ ] User can sort applications.
- [ ] User can view dashboard.
- [ ] User can export JSON.
- [ ] User can export CSV.
- [ ] User can import JSON.
- [ ] Application is installable as PWA.
- [ ] Application works responsively on mobile and desktop.

---

## 3.2 Engineering Definition of Done

- [ ] Frontend is built with Next.js.
- [ ] Backend is built with Express.
- [ ] Both frontend and backend use TypeScript.
- [ ] Frontend uses RTK Query for API data.
- [ ] Backend uses PostgreSQL.
- [ ] Prisma migrations are committed.
- [ ] Local development setup works.
- [ ] Docker Compose database setup works.
- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] E2E critical flows pass.
- [ ] Lint passes.
- [ ] Typecheck passes.
- [ ] Build passes.
- [ ] No secrets are committed.
- [ ] Environment variables are documented.
- [ ] README is complete.
- [ ] API health endpoint works.
- [ ] Production deployment works.

---

## 3.3 UI/UX Definition of Done

- [ ] Primary color is `#6366f1`.
- [ ] UI uses minimal shadows.
- [ ] UI uses compact radius.
- [ ] Buttons and inputs use `6px` radius.
- [ ] Cards/modals use maximum `8px` radius.
- [ ] Badges/tags use small radius.
- [ ] Empty states are implemented.
- [ ] Loading states are implemented.
- [ ] Error states are implemented.
- [ ] Success feedback is implemented.
- [ ] Offline banner is implemented.
- [ ] Light theme works.
- [ ] Dark theme works.
- [ ] System theme works.
- [ ] Mobile layout works.
- [ ] Tablet layout works.
- [ ] Desktop layout works.

---

# 4. Test Environments

## 4.1 Required Environments

| Environment | Purpose                        |
| ----------- | ------------------------------ |
| Local       | Development and manual testing |
| Preview     | Pull request testing           |
| Production  | Final release testing          |

---

## 4.2 Recommended Test Accounts

Create test users before testing:

| Test User                      | Purpose                                  |
| ------------------------------ | ---------------------------------------- |
| Unverified email/password user | Email verification tests                 |
| Verified email/password user   | Core app tests                           |
| OAuth-only user                | Set password and connected account tests |
| User with many applications    | Pagination/filter/performance tests      |
| Second verified user           | Ownership/security tests                 |

---

# 5. Functional Testing Checklist

## 5.1 Registration

- [ ] Registration page renders correctly.
- [ ] Name, email, and password fields are visible.
- [ ] Required validation works.
- [ ] Invalid email is rejected.
- [ ] Weak/short password is rejected.
- [ ] Duplicate email is rejected.
- [ ] Successful registration creates unverified user.
- [ ] Verification email is sent.
- [ ] Success message is shown.
- [ ] User is not given full access before verification.

---

## 5.2 Email Verification

- [ ] Verification email contains correct link.
- [ ] Valid token verifies email.
- [ ] Verified user can log in.
- [ ] Verification success directs the user to sign in and does not assume a session.
- [ ] Invalid token shows error.
- [ ] Expired token shows error.
- [ ] Already-used token shows error.
- [ ] Verification token is removed from browser history after extraction.
- [ ] Resend verification email works.
- [ ] Resend verification is rate-limited.
- [ ] Resend response does not reveal whether email exists.

---

## 5.3 Login

- [ ] Login page renders correctly.
- [ ] Valid verified credentials log in successfully.
- [ ] Invalid credentials show generic error.
- [ ] Unverified user is blocked from full access.
- [ ] Unverified user can resend verification email.
- [ ] Login button shows loading state.
- [ ] Successful login redirects correctly.
- [ ] Session persists after page reload.
- [ ] Logout clears session.

---

## 5.4 Social Login

- [ ] Google login button works.
- [ ] GitHub login button works.
- [ ] New OAuth user is created when no account exists.
- [ ] OAuth user is considered email verified.
- [ ] Existing user with same verified provider email is linked safely.
- [ ] Unverified provider email is rejected.
- [ ] OAuth callback handles errors gracefully.
- [ ] After OAuth login, intended route wins; otherwise saved landing preference is used.
- [ ] OAuth session persists after reload.
- [ ] OAuth user can log out.

---

## 5.5 Forgot Password

- [ ] Forgot password page renders.
- [ ] Email field is required.
- [ ] Valid email triggers reset email.
- [ ] Response does not reveal whether account exists.
- [ ] Reset email contains correct link.
- [ ] Request is rate-limited.
- [ ] A new reset request invalidates older unused reset links for that user.

---

## 5.6 Reset Password

- [ ] Reset password page renders with token.
- [ ] Valid token allows password reset.
- [ ] New password validation works.
- [ ] Password confirmation works.
- [ ] Invalid token shows error.
- [ ] Expired token shows error.
- [ ] Used token shows error.
- [ ] Reset token is removed from browser history after extraction.
- [ ] Successful reset revokes every refresh session; existing access tokens
      cannot outlive their documented 15-minute expiry.
- [ ] User can log in with new password.

---

## 5.7 Change Password

- [ ] Change password is available in Settings.
- [ ] Current password is required for password users.
- [ ] Wrong current password is rejected.
- [ ] New password validation works.
- [ ] Password confirmation works.
- [ ] Successful change shows success toast.
- [ ] User remains logged in or is safely re-authenticated.
- [ ] Other sessions are revoked where implemented.

---

## 5.8 Set Password for OAuth-only User

- [ ] OAuth-only user sees “Set Password”.
- [ ] Current password is not required.
- [ ] New password validation works.
- [ ] Password confirmation works.
- [ ] Password is saved successfully.
- [ ] User can now log in with email/password.
- [ ] OAuth login still works.
- [ ] User with existing password cannot use set-password flow.

---

## 5.9 Connected Accounts

- [ ] Connected accounts page shows Google status.
- [ ] Connected accounts page shows GitHub status.
- [ ] User can connect Google.
- [ ] User can connect GitHub.
- [ ] User can disconnect Google.
- [ ] User can disconnect GitHub.
- [ ] System prevents removing last login method.
- [ ] Confirmation dialog appears before unlinking.
- [ ] Success/error feedback is shown.

---

## 5.10 Application Management

- [ ] User can create application.
- [ ] Company and role are required.
- [ ] Optional fields save correctly.
- [ ] Initial note and tag assignments are created atomically with the application.
- [ ] Invalid URL is rejected.
- [ ] Salary min/max validation works.
- [ ] Salary values require a valid three-letter currency.
- [ ] Follow-up date saves correctly.
- [ ] Application appears in list.
- [ ] Application detail page loads.
- [ ] User can edit application.
- [ ] User can delete application.
- [ ] Delete confirmation appears.
- [ ] User can archive application.
- [ ] Archived application is hidden by default.
- [ ] User can unarchive application.
- [ ] User cannot access another user’s application.

---

## 5.11 Status Management

- [ ] Status can be changed from list/detail and from board when that optional enhancement is enabled.
- [ ] Status badge updates immediately.
- [ ] Status history entry is created.
- [ ] Optional status note can be added.
- [ ] Status history appears in Activity tab.
- [ ] Invalid status values are rejected.
- [ ] Selecting the current status does not create a duplicate history row.
- [ ] General application update cannot bypass status-history creation.
- [ ] Dashboard counts update after status change.

---

## 5.12 Search, Filter, Sort

- [ ] Search by company works.
- [ ] Search by role works.
- [ ] Search by location works.
- [ ] Search by tag works.
- [ ] Search by note content works.
- [ ] Search is debounced.
- [ ] Filter by status works.
- [ ] Filter by tag works.
- [ ] Filter by remote type works.
- [ ] Filter by employment type works.
- [ ] Filter by source works.
- [ ] Filter by applied date works.
- [ ] Filter by follow-up state works.
- [ ] Archived filter works.
- [ ] Sorting works.
- [ ] Clear filters works.
- [ ] No results state appears correctly.
- [ ] URL query params update correctly.

---

## 5.13 Pagination

- [ ] Application list paginates correctly.
- [ ] Page size works.
- [ ] Next/previous buttons work.
- [ ] Desktop pagination works.
- [ ] Mobile pagination works.
- [ ] Pagination resets appropriately after filter change.

---

## 5.14 Kanban Board (Conditional Should Have)

This section is evaluated only when the PRD Should Have board enhancement is
included in the release. It does not block the base MVP.

- [ ] Board displays all status columns.
- [ ] Cards show company and role.
- [ ] Cards show tags.
- [ ] Cards show follow-up indicator.
- [ ] Drag-and-drop changes status, if drag-and-drop is shipped.
- [ ] Status history updates after drag-drop.
- [ ] Accessible status menu works.
- [ ] Board works on tablet/mobile with horizontal scroll.
- [ ] Board does not break with empty columns.

---

## 5.15 Tags

- [ ] User can create tag.
- [ ] Tag name is required.
- [ ] Duplicate tag name per user is rejected.
- [ ] Tag uniqueness rejects case/whitespace variants after normalization.
- [ ] User can edit tag.
- [ ] User can delete tag.
- [ ] Deleting tag removes it from applications.
- [ ] User can assign tag to application.
- [ ] User can remove tag from application.
- [ ] Tags appear in application list/detail.
- [ ] Tags can be used in filters.

---

## 5.16 Notes

- [ ] User can add note to application.
- [ ] Empty note is rejected.
- [ ] Long note over limit is rejected.
- [ ] Notes appear newest first.
- [ ] User can edit note.
- [ ] User can delete note.
- [ ] Delete confirmation appears.
- [ ] Notes are visible only to owning user.

---

## 5.17 Interviews

- [ ] User can add interview.
- [ ] Interview type is required.
- [ ] Scheduled date/time is required.
- [ ] Interview status defaults correctly.
- [ ] User can edit interview.
- [ ] User can delete interview.
- [ ] Interview appears under application.
- [ ] Interview appears on Interviews page.
- [ ] Upcoming interviews sort correctly.
- [ ] Past interviews sort correctly.
- [ ] Meeting link opens in new tab.
- [ ] Dashboard shows upcoming interviews.

---

## 5.18 Dashboard

- [ ] Total applications count is correct.
- [ ] Active applications count is correct.
- [ ] Active count includes only Applied, Screening, and Interview.
- [ ] Scheduled interviews count is correct.
- [ ] Offers count is correct.
- [ ] Overdue follow-ups appear.
- [ ] Today follow-ups appear.
- [ ] Archived applications are excluded from every dashboard metric/list.
- [ ] Today/overdue boundaries use the saved user time zone.
- [ ] Status distribution chart is correct.
- [ ] Recent applications appear.
- [ ] Upcoming interviews appear.
- [ ] Empty dashboard shows onboarding CTA.
- [ ] Dashboard links navigate correctly.

---

## 5.19 Settings

- [ ] User can update name.
- [ ] Email is read-only.
- [ ] Theme preference saves.
- [ ] Default landing page preference saves.
- [ ] Default landing page is honored after authentication when no intended route exists.
- [ ] Time-zone preference saves and affects dashboard day boundaries.
- [ ] Notification preference saves, if the optional control is exposed.
- [ ] Password section displays correct state.
- [ ] Connected accounts display correctly.
- [ ] Export JSON works.
- [ ] Export CSV works.
- [ ] Import JSON validation works.
- [ ] Import confirmation appears.
- [ ] Import replaces data safely.
- [ ] Invalid import file shows error.

---

# 6. UI/UX Testing Checklist

## 6.1 Visual Style

- [ ] Primary buttons use `#6366f1`.
- [ ] Hover states use correct primary hover color.
- [ ] Focus states are visible.
- [ ] Cards use borders instead of heavy shadows.
- [ ] Modals use maximum `8px` radius.
- [ ] Inputs/buttons use `6px` radius.
- [ ] Badges/tags use compact radius.
- [ ] Status badges use subtle backgrounds.
- [ ] Danger actions use red styling.
- [ ] Warning states use amber styling.
- [ ] Success states use green styling.

---

## 6.2 Layout

- [ ] Desktop sidebar works.
- [ ] Mobile bottom navigation works.
- [ ] Top bar works.
- [ ] Global search is accessible.
- [ ] Add Application action is easy to find.
- [ ] Page titles are clear.
- [ ] Content max-width looks correct.
- [ ] No horizontal overflow on mobile.

---

## 6.3 States

- [ ] Loading skeletons appear where required.
- [ ] Buttons show loading spinners.
- [ ] Empty states appear with helpful CTA.
- [ ] Error states appear with retry where useful.
- [ ] Success toasts appear.
- [ ] Offline banner appears when offline.
- [ ] Unauthorized users are redirected.

---

## 6.4 Forms

- [ ] Labels are visible.
- [ ] Required fields are marked.
- [ ] Inline errors appear below fields.
- [ ] Password fields have show/hide toggle.
- [ ] Date pickers are usable.
- [ ] Submit buttons disable while loading.
- [ ] Forms prevent double submission.
- [ ] Success and error feedback is clear.

---

## 6.5 Modals and Dialogs

- [ ] Modals open smoothly.
- [ ] Escape closes modal.
- [ ] Focus is trapped inside modal.
- [ ] Focus returns to trigger after close.
- [ ] Confirmation dialogs are clear.
- [ ] Danger buttons are visually distinct.
- [ ] Mobile sheets/modals are usable.

---

# 7. Frontend Testing Checklist

## 7.1 Framework and Structure

- [ ] Next.js app runs without errors.
- [ ] TypeScript strict mode passes.
- [ ] Lint passes.
- [ ] Production build passes.
- [ ] Folder structure follows frontend spec.
- [ ] Reusable components are not duplicated unnecessarily.

---

## 7.2 Routing and Guards

- [ ] Public routes are accessible when logged out.
- [ ] Protected routes redirect unauthenticated users.
- [ ] Authenticated users are redirected away from login/register.
- [ ] Unverified users are restricted appropriately.
- [ ] Redirect after login returns user to intended page.
- [ ] Social callback restores the session before entering a protected route.
- [ ] 404 page works.
- [ ] Offline fallback page works.

---

## 7.3 RTK Query

- [ ] All API calls use RTK Query.
- [ ] No direct fetch/axios calls in components.
- [ ] Cache invalidation works.
- [ ] Mutations update UI correctly.
- [ ] Duplicate requests are avoided.
- [ ] Loading/error states are handled.
- [ ] Optimistic updates, if used, are safe.

---

## 7.4 Authentication Handling

- [ ] Access token is stored only in memory.
- [ ] Refresh cookie is sent with credentials.
- [ ] 401 triggers refresh flow.
- [ ] Refresh flow retries original request.
- [ ] Failed refresh redirects to login.
- [ ] Logout clears auth state.
- [ ] Auth state survives page reload when session valid.

---

## 7.5 State and URL

- [ ] Search/filter/sort state is reflected in URL.
- [ ] Browser back/forward works correctly.
- [ ] Filters persist after refresh.
- [ ] Debounced search works.
- [ ] UI state does not cause unnecessary re-renders.

---

## 7.6 Theme

- [ ] Light theme works.
- [ ] Dark theme works.
- [ ] System theme works.
- [ ] Theme persists after reload.
- [ ] No flash of wrong theme on load.
- [ ] Theme toggle is accessible.

---

# 8. Backend Testing Checklist

## 8.1 API Basics

- [ ] API prefix is `/api/v1`.
- [ ] Health endpoint works.
- [ ] JSON API responses use the standard envelope, except documented raw
      download and redirect endpoints.
- [ ] Error responses use standard envelope.
- [ ] 404 handler works.
- [ ] 500 errors do not expose internals.
- [ ] Request IDs are present.
- [ ] Compression is enabled.
- [ ] Body size limit is configured.

---

## 8.2 Authentication API

- [ ] Register endpoint works.
- [ ] Login endpoint works.
- [ ] Logout endpoint works.
- [ ] Refresh endpoint works.
- [ ] Refresh token rotation works.
- [ ] Old refresh token is revoked after rotation.
- [ ] Reuse of a replaced refresh token revokes the user's refresh sessions.
- [ ] Access token expires correctly.
- [ ] `/auth/me` returns current user.
- [ ] Invalid access token returns 401.
- [ ] Missing access token returns 401.
- [ ] Email verification endpoint works.
- [ ] Resend verification endpoint works.
- [ ] Forgot password endpoint works.
- [ ] Reset password endpoint works.
- [ ] Change password endpoint works.
- [ ] Set password endpoint works.
- [ ] Connected accounts endpoint works.
- [ ] Authenticated provider-link start endpoint returns an authorization URL.
- [ ] Provider-link callback is bound to the initiating user and one-time state.
- [ ] Unlink provider endpoint works.
- [ ] Last login method cannot be removed.

---

## 8.3 Resource API

- [ ] Application CRUD endpoints work.
- [ ] Application archive endpoints work.
- [ ] Application status endpoint works.
- [ ] Status history endpoint works.
- [ ] Tag endpoints work.
- [ ] Note endpoints work.
- [ ] Interview endpoints work.
- [ ] Dashboard summary endpoint works.
- [ ] Export JSON endpoint works.
- [ ] Export CSV endpoint works.
- [ ] Import JSON endpoint works.

---

## 8.4 Validation and Authorization

- [ ] Zod validation rejects invalid payloads.
- [ ] Query params are validated.
- [ ] Route params are validated.
- [ ] Authenticated user cannot access another user’s data.
- [ ] Protected routes require authentication.
- [ ] Verified routes require email verification.
- [ ] Ownership checks are enforced in services/repositories.

---

## 8.5 Security Backend

- [ ] Passwords are hashed with bcrypt.
- [ ] Password hash is never returned.
- [ ] Refresh tokens are stored hashed.
- [ ] Verification tokens are stored hashed.
- [ ] Reset tokens are stored hashed.
- [ ] CORS only allows configured frontend origin.
- [ ] Cookie is HTTP-only.
- [ ] Cookie is secure in production.
- [ ] Cookie SameSite is correct.
- [ ] Refresh/logout reject disallowed origins and missing requested-with header.
- [ ] Auth endpoints are rate-limited.
- [ ] OAuth state is validated.
- [ ] Logs do not contain secrets.
- [ ] Error messages do not leak sensitive data.

---

# 9. Database Testing Checklist

## 9.1 Schema

- [ ] Prisma schema matches database spec.
- [ ] Enums are defined correctly.
- [ ] Tables are named correctly.
- [ ] Prisma camelCase fields map to documented snake_case columns.
- [ ] Timestamps use `Timestamptz`; applied date uses PostgreSQL `date`.
- [ ] Relations are defined correctly.
- [ ] Foreign keys exist.
- [ ] Timestamps exist where required.
- [ ] Migrations are committed.
- [ ] Migrations run cleanly from scratch.

---

## 9.2 Data Integrity

- [ ] User email is unique.
- [ ] Email is stored lowercase.
- [ ] Verified users have an `email_verified_at` timestamp.
- [ ] OAuth account is unique per provider/providerAccountId.
- [ ] A user cannot link more than one account for the same provider.
- [ ] Tag name is unique per user.
- [ ] ApplicationTag assignment is unique.
- [ ] Salary constraints work.
- [ ] Note content length constraint works.
- [ ] Tag name length constraint works.
- [ ] Tokens are stored hashed.
- [ ] Passwords are stored hashed.

---

## 9.3 Cascade Rules

- [ ] Deleting user deletes owned data.
- [ ] Deleting application deletes notes.
- [ ] Deleting application deletes interviews.
- [ ] Deleting application deletes status history.
- [ ] Deleting application deletes application tags.
- [ ] Deleting tag deletes application tag assignments.
- [ ] Refresh tokens are deleted when user is deleted.
- [ ] OAuth accounts are deleted when user is deleted.

---

## 9.4 Indexes and Queries

- [ ] Application list queries are performant.
- [ ] Dashboard aggregate queries are performant.
- [ ] Follow-up queries use expected indexes.
- [ ] Interview queries sort correctly.
- [ ] Status history queries sort correctly.
- [ ] No obvious N+1 queries in critical flows.

---

# 10. PWA Testing Checklist

## 10.1 Manifest

- [ ] Manifest file is accessible.
- [ ] App name is correct.
- [ ] Short name is correct.
- [ ] Start URL is correct.
- [ ] Display mode is standalone.
- [ ] Theme color uses `#6366f1`.
- [ ] Icons load correctly.
- [ ] Maskable icon exists.

---

## 10.2 Service Worker

- [ ] Service worker registers in production.
- [ ] Static assets are cached.
- [ ] Offline fallback page works.
- [ ] Old caches are cleaned after new deployment.
- [ ] Update prompt appears when new version is available.
- [ ] Reload action works.

---

## 10.3 Installability

- [ ] Install prompt appears where supported.
- [ ] App can be installed on mobile.
- [ ] App can be installed on desktop.
- [ ] Installed app opens in standalone mode.
- [ ] Installed app navigation works.

---

## 10.4 Offline Behavior

- [ ] Offline banner appears when network is lost.
- [ ] Offline fallback page works.
- [ ] Mutations while offline show warning.
- [ ] No silent data loss occurs while offline.
- [ ] App recovers when network returns.
- [ ] Data refreshes after reconnecting.

---

# 11. Security Testing Checklist

## 11.1 Authentication Security

- [ ] Passwords are hashed.
- [ ] Password reset tokens expire.
- [ ] Email verification tokens expire.
- [ ] Refresh tokens rotate.
- [ ] Refresh tokens are revocable.
- [ ] Access tokens are short-lived.
- [ ] Access token is not stored in localStorage.
- [ ] Logout revokes session.
- [ ] Password reset revokes all refresh sessions; access-token residual life is at most 15 minutes.
- [ ] Unverified users cannot access protected data.

---

## 11.2 Authorization Security

- [ ] User A cannot read User B’s applications.
- [ ] User A cannot edit User B’s applications.
- [ ] User A cannot delete User B’s applications.
- [ ] User A cannot access User B’s notes.
- [ ] User A cannot access User B’s interviews.
- [ ] User A cannot access User B’s tags.
- [ ] API endpoints enforce ownership.
- [ ] Frontend guards do not replace backend authorization.

---

## 11.3 Input Security

- [ ] SQL injection is prevented by Prisma.
- [ ] XSS is prevented by framework escaping.
- [ ] Invalid JSON is rejected.
- [ ] Oversized payloads are rejected.
- [ ] Invalid imports are rejected.
- [ ] File/data imports do not execute code.
- [ ] CSV export neutralizes spreadsheet-formula injection in user-controlled cells.
- [ ] External links use `rel="noopener noreferrer"` where appropriate.

---

## 11.4 HTTP Security

- [ ] HTTPS is enforced in production.
- [ ] Security headers are set.
- [ ] CORS is restricted.
- [ ] Cookies are HTTP-only.
- [ ] Cookies are secure in production.
- [ ] Rate limiting is enabled on auth routes.
- [ ] Cookie-authenticated mutations validate the configured frontend origin.
- [ ] Logs do not expose sensitive data.

---

# 12. Accessibility Testing Checklist

## 12.1 Keyboard Accessibility

- [ ] All interactive elements are keyboard accessible.
- [ ] Tab order is logical.
- [ ] Focus is visible.
- [ ] Escape closes modals.
- [ ] Modal focus trap works.
- [ ] Skip-to-content link works.
- [ ] Drag-and-drop has accessible alternative.

---

## 12.2 Screen Reader Accessibility

- [ ] Form inputs have labels.
- [ ] Error messages are associated with fields.
- [ ] Buttons have accessible names.
- [ ] Icon-only buttons have tooltips/aria-labels.
- [ ] Toasts use live regions.
- [ ] Navigation landmarks exist.
- [ ] Headings follow logical order.

---

## 12.3 Visual Accessibility

- [ ] Color contrast meets WCAG AA.
- [ ] Color is not the only status indicator.
- [ ] Focus indicators are clear.
- [ ] Reduced motion is respected.
- [ ] Text remains readable at zoom levels.

---

# 13. Performance Testing Checklist

## 13.1 Frontend Performance

- [ ] Initial page load is reasonably fast.
- [ ] Route transitions are smooth.
- [ ] No unnecessary large bundle imports.
- [ ] Charts are lazy loaded if heavy.
- [ ] Drag-and-drop library is loaded only where needed.
- [ ] Images/icons are optimized.
- [ ] Fonts are optimized.
- [ ] No major console errors.
- [ ] No excessive re-renders in lists.

---

## 13.2 Backend Performance

- [ ] Application list pagination works.
- [ ] Dashboard summary uses efficient queries.
- [ ] Status change uses transaction.
- [ ] Import/export handles reasonable data size.
- [ ] No obvious N+1 queries.
- [ ] Health check responds quickly.

---

## 13.3 Lighthouse Targets

Target scores:

| Category       | Target |
| -------------- | ------ |
| Performance    | 90+    |
| Accessibility  | 90+    |
| Best Practices | 90+    |
| SEO            | 90+    |

If a score is below target, document reason and fix critical issues.

---

# 14. Automated Testing Checklist

## 14.1 Unit Tests

- [ ] Password utilities tested.
- [ ] Token hashing utilities tested.
- [ ] JWT utilities tested.
- [ ] Validation schemas tested.
- [ ] Date helpers tested.
- [ ] Pagination helpers tested.
- [ ] Status logic tested.
- [ ] Auth service logic tested.
- [ ] Application service logic tested.

---

## 14.2 Component Tests

- [ ] LoginForm tested.
- [ ] RegisterForm tested.
- [ ] ForgotPasswordForm tested.
- [ ] ResetPasswordForm tested.
- [ ] ApplicationForm tested.
- [ ] TagInput tested.
- [ ] FilterBar tested.
- [ ] StatusBadge tested.
- [ ] EmptyState tested.
- [ ] Modal tested.
- [ ] Toast tested.
- [ ] OfflineBanner tested.

---

## 14.3 API Integration Tests

- [ ] Health endpoint tested.
- [ ] Register tested.
- [ ] Login tested.
- [ ] Email verification tested.
- [ ] Forgot password tested.
- [ ] Reset password tested.
- [ ] Change password tested.
- [ ] Set password tested.
- [ ] Refresh token tested.
- [ ] Logout tested.
- [ ] Application CRUD tested.
- [ ] Ownership enforcement tested.
- [ ] Status change tested.
- [ ] Tags tested.
- [ ] Notes tested.
- [ ] Interviews tested.
- [ ] Export/import tested.

---

## 14.4 E2E Tests

Critical flows:

- [ ] Register new user.
- [ ] Verify email.
- [ ] Login.
- [ ] Create application.
- [ ] Edit application.
- [ ] Change status.
- [ ] Add note.
- [ ] Add interview.
- [ ] Search/filter application.
- [ ] Logout.
- [ ] Forgot password request.
- [ ] OAuth login, if testable.
- [ ] PWA smoke test, if automated.

---

## 14.5 CI Checks

- [ ] Install succeeds.
- [ ] Lint succeeds.
- [ ] Typecheck succeeds.
- [ ] Unit tests succeed.
- [ ] Integration tests succeed.
- [ ] Build succeeds.
- [ ] Critical E2E tests pass in the release-candidate workflow; running the
      complete suite on every pull request is optional.
- [ ] CI fails on broken tests.
- [ ] CI runs on pull requests.
- [ ] CI runs on push to main.

---

# 15. Operations Testing Checklist

## 15.1 Local Setup

- [ ] README setup instructions work.
- [ ] `pnpm install` works.
- [ ] Docker Compose starts database.
- [ ] Environment examples exist.
- [ ] Backend starts locally.
- [ ] Frontend starts locally.
- [ ] Database migrations run locally.
- [ ] Seed script works.
- [ ] Local OAuth callback URLs work.
- [ ] Local email console provider works.

---

## 15.2 Production Deployment

- [ ] Frontend deploys successfully.
- [ ] Backend deploys successfully.
- [ ] Database migrations run successfully.
- [ ] Production environment variables are set.
- [ ] Production secrets are not in logs.
- [ ] Runtime and migration database credentials are separated in production.
- [ ] CORS uses production frontend URL.
- [ ] Cookie settings are production-safe.
- [ ] Health endpoint returns healthy.
- [ ] HTTPS works.
- [ ] PWA works in production.

---

## 15.3 Monitoring and Logs

- [ ] Backend logs are visible.
- [ ] Frontend deployment logs are visible.
- [ ] Request logs include request ID.
- [ ] Errors are logged.
- [ ] No sensitive data appears in logs.
- [ ] Health check monitoring is configured.
- [ ] Deployment status is visible.

---

## 15.4 Backup and Rollback

- [ ] Database backup exists.
- [ ] Backup restore process is documented.
- [ ] Frontend rollback works.
- [ ] Backend rollback works.
- [ ] Migration rollback strategy is documented.
- [ ] Export/import can be used as user-level backup.
- [ ] Risky migrations are tested before production.

---

# 16. Regression Checklist

Before release, rerun these critical flows:

- [ ] Register.
- [ ] Verify email.
- [ ] Login.
- [ ] Social login.
- [ ] Forgot password.
- [ ] Reset password.
- [ ] Create application.
- [ ] Edit application.
- [ ] Delete application.
- [ ] Change status.
- [ ] Add note.
- [ ] Add interview.
- [ ] Filter/search.
- [ ] Dashboard loads.
- [ ] Export JSON.
- [ ] Import JSON.
- [ ] Logout.
- [ ] PWA install/offline fallback.

---

# 17. Bug Severity Definitions

## Critical

Must fix before release.

Examples:

- App crashes.
- Login broken.
- Data leak between users.
- Password reset broken.
- Production database migration fails.
- Secrets exposed.
- Deployment fails.

---

## High

Should fix before release.

Examples:

- Core CRUD broken.
- Status history not created.
- OAuth login fails.
- Dashboard shows wrong counts.
- Export/import fails.
- PWA install broken.

---

## Medium

Can be fixed soon after release if not blocking.

Examples:

- Minor UI inconsistency.
- Non-critical validation message issue.
- Minor accessibility issue.
- Minor performance issue.

---

## Low

Can be moved to backlog.

Examples:

- Cosmetic polish.
- Minor copy improvement.
- Optional UX enhancement.

---

# 18. Release Blockers

The release must be blocked if any of these exist:

- [ ] User data is accessible across accounts.
- [ ] Authentication is broken.
- [ ] Email verification is broken.
- [ ] Password reset is broken.
- [ ] Production migration fails.
- [ ] Backend health check fails.
- [ ] Application cannot be deployed.
- [ ] Secrets are exposed.
- [ ] Critical PWA failure occurs.
- [ ] Critical database integrity issue exists.

---

# 19. Final Release Checklist

## Pre-release

- [ ] All Must Have features are implemented.
- [ ] All test checklists completed.
- [ ] No critical bugs open.
- [ ] No high release blockers open.
- [ ] CI passes.
- [ ] Database migrations tested.
- [ ] Production environment configured.
- [ ] Backup available.
- [ ] Rollback plan confirmed.

---

## Deployment

- [ ] Merge final release branch to main.
- [ ] Frontend deployment succeeds.
- [ ] Backend deployment succeeds.
- [ ] Database migration succeeds.
- [ ] Health check passes.
- [ ] Smoke test passes.
- [ ] Logs show no critical errors.

---

## Post-release

- [ ] Register works in production.
- [ ] Email verification works in production.
- [ ] Login works in production.
- [ ] Social login works in production.
- [ ] Password reset works in production.
- [ ] Dashboard works in production.
- [ ] Application CRUD works in production.
- [ ] PWA install works in production.
- [ ] Offline fallback works in production.
- [ ] Export/import works in production.
- [ ] Monitoring/health checks are active.
- [ ] Deployment is marked complete.

---

# 20. Sign-off

| Area                 | Status                  | Notes |
| -------------------- | ----------------------- | ----- |
| Product Requirements | Complete / Not Complete |       |
| UI/UX                | Complete / Not Complete |       |
| Frontend             | Complete / Not Complete |       |
| Backend              | Complete / Not Complete |       |
| Database             | Complete / Not Complete |       |
| PWA                  | Complete / Not Complete |       |
| Security             | Complete / Not Complete |       |
| Testing              | Complete / Not Complete |       |
| Operations           | Complete / Not Complete |       |
| Final Release        | Approved / Blocked      |       |

---

## 21. MVP Completion Rule

The MVP is complete only when:

```txt
All Must Have features work,
all critical checklists pass,
no critical release blockers remain,
and the application is deployed successfully with health checks passing.
```
