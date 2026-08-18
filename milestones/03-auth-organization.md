# Milestone 03 — Authentication & Organization Boundary

## Objective
Allow users to authenticate and operate only within organizations they are authorized to access.

## Preconditions
- Milestones 01–02 GREEN.
- Project state permits Milestone 03.

## In Scope
- Supabase Auth using email/password.
- Signup.
- Login.
- Logout.
- Protected application shell.
- Organization bootstrap/creation flow.
- Membership resolution.
- Server-side authorization helpers.
- Minimal authenticated navigation shell.
- Auth/session error handling.
- Audit material organization/account events where appropriate.

## Explicitly Out of Scope
- Marketplace API connection.
- Mock seller data.
- Money Finder.
- Recovery metrics.
- Billing.
- Social OAuth.

## Required Tests
- Unauthenticated user cannot access protected routes.
- Authenticated user can access authorized organization.
- User A cannot access Organization B by manipulating URL/ID/request.
- Logout invalidates protected access.
- Server authorization remains effective even if client UI is bypassed.
- Privileged Supabase/service credentials do not appear in client bundle.

## Acceptance Criteria
- AC-01: Signup/login/logout E2E GREEN.
- AC-02: Protected-route tests GREEN.
- AC-03: Cross-tenant authorization GREEN.
- AC-04: Browser secret-exposure test GREEN.
- AC-05: No fake recovery/dashboard data.
- AC-06: Full quality gate GREEN.

## Completion
After GREEN:
- Last GREEN Milestone = 03.
- Current Allowed Milestone = 04.
- STOP.
