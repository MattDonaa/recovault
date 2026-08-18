# RecoVault — Authentication & Authorization

Status: established at **Milestone 03**.

## Overview
Users authenticate with email/password and may only operate within
organizations they are authorized to access. Authentication is delegated to a
provider; **authorization** (who may act within which organization) is enforced
server-side by the application, independent of any UI.

## Modes (mock-first)
Identity and membership are resolved through provider-agnostic contracts
(`src/core/auth/types.ts`), selected in exactly one place
(`src/lib/auth/index.ts`):

| | Live mode | Mock mode (default) |
|---|---|---|
| Selected when | all three `SUPABASE_*` vars are set | otherwise |
| Identity | `SupabaseAuthProvider` (Supabase Auth) | `MockAuthProvider` (scrypt, in-memory) |
| Membership | `SupabaseMembershipStore` (DB + RLS) | `InMemoryMembershipStore` |

The mock provider is a contract-faithful double (real password hashing, real
membership resolution, real audit records) — not fake UI. It lets the auth and
authorization behavior be verified deterministically and offline, exactly as
the mock marketplace adapter will be. The live path is exercised in the live
milestone once Supabase credentials exist.

## Sessions
The application mints its own signed session cookie after a provider verifies
credentials, so session handling is uniform across modes:
- `rv_session` cookie: `HttpOnly`, `SameSite=Lax`, `Secure` in production.
- Value: `base64url(payload).HMAC-SHA256(payload)` with `AUTH_SESSION_SECRET`.
- Tamper-evident and carries an expiry; verified on every protected request
  (`src/core/auth/session.ts`).
- `AUTH_SESSION_SECRET` is required (≥16 chars) in production; a dev fallback is
  used only outside production.

## Enforcement layers
1. **Edge middleware** (`src/middleware.ts`) — fast coarse guard: redirects
   requests to `/app/*` without a session cookie to `/login`. Imports only
   crypto-free constants (`src/core/auth/constants.ts`).
2. **Server guards** (`src/core/auth/guards.ts`) — the real enforcement:
   - `requireSession()` verifies the signed cookie or redirects to `/login`.
   - `requireOrgAccess(orgId)` resolves membership via the store; a non-member
     receives a **404** (existence is not disclosed). This holds even if the
     client UI or middleware is bypassed, because it runs in the server
     component/action.

## Flows
- **Signup / Login / Logout / Create organization** are React Server Actions
  (`src/app/auth-actions.ts`) with Zod-validated input and non-sensitive error
  messages. Redirects are performed outside try/catch so they are never
  swallowed. `next` redirect targets are restricted to internal `/app` paths
  (no open redirects).
- Creating an organization seeds the creator as `owner` and records an
  `organization.created` audit event (DB trigger in live mode; in-memory record
  in mock mode).

## Secret handling
- The service-role key and session secret are server-only and never referenced
  by client code. An E2E test (`tests/e2e/secret-exposure.spec.ts`) boots the
  server with sentinel secret values and asserts they never appear in any HTML
  or JS served to the browser, including the authenticated shell.

## No fabricated data
The authenticated shell shows only real auth/organization state. Organization
pages explicitly state that no marketplace is connected and that RecoVault never
displays fabricated recovery figures — marketplace/recovery features arrive in
later milestones.

## Tests
- Unit: session sign/verify + tamper/expiry, password hash/verify, authorization
  logic, mock provider + membership isolation (`tests/unit/auth-*.test.ts`).
- E2E: signup → create org → view → logout revokes access; unauthenticated
  redirect; login after signup; invalid-credential error; cross-tenant URL
  denial; client-bundle secret scan (`tests/e2e/auth.spec.ts`,
  `tests/e2e/secret-exposure.spec.ts`). E2E runs against a production build.
