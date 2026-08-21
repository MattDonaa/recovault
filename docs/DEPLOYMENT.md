# RecoVault — Deployment Runbook

Target platform: **Vercel** (Next.js App Router). Database & auth: **Supabase**.
Hosted Supabase project (current): `fxesioydpmkgbycqsmts` (schema 0011 GREEN).

## 1. Provision Supabase
1. Create a Supabase project.
2. Apply the SQL migrations in order — they are the single schema source of
   truth (`supabase/migrations/0001_…` … `0011_…`), e.g. via the Supabase CLI:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```
   Migrations create all tenant tables with Row-Level Security enabled, pin
   least-privilege grants for `anon`/`authenticated`/`service_role` (0010–0011),
   and depend only on the Supabase-provided `auth` schema and roles.

## 2. Environment variables
`.env.example` lists every variable with placeholders (never real values). Local
secrets go in `.env.local` (git-ignored). `NEXT_PUBLIC_*` values are inlined into
the **client bundle at build time**, so only non-secret values may ever use that
prefix; server-only secrets must never be given a `NEXT_PUBLIC_` name.

### 2.1 Classification
| Variable | Class | Secret? | Where set |
|---|---|---|---|
| `NEXT_PUBLIC_APP_NAME` | client-safe | no | all (has default) |
| `NEXT_PUBLIC_APP_ENV` | client-safe | no | all (`development`/`preview`/`production`) |
| `NODE_ENV` | platform | no | set automatically by Next/Vercel |
| `NEXT_PUBLIC_SUPABASE_URL` | client-safe (public) | no | local · Preview · Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client-safe (publishable) | no | local · Preview · Production |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** | **SECRET** (bypasses RLS) | local (`.env.local`) · Preview · Production |
| `AUTH_SESSION_SECRET` | **server-only** | **SECRET** (HMAC cookie signing) | local · Preview · Production |
| `MARKETPLACE_ENCRYPTION_KEY` | **server-only** | **SECRET** (AES-256 key) | local · Preview · Production |
| `TAKEALOT_API_KEY` | **server-only** | **SECRET** | **not set until a real seller (M14)** |

Required in production (`REQUIRED_PRODUCTION_ENV`, enforced by
`validateProductionEnv()`): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`AUTH_SESSION_SECRET`, `MARKETPLACE_ENCRYPTION_KEY`. Generate the two app secrets
with `openssl rand -base64 32`.

### 2.2 Mode selection
- **MOCK** (default when any of the Supabase trio is unset): in-memory auth +
  synthetic marketplace data.
- **LIVE** (all three of `NEXT_PUBLIC_SUPABASE_URL` +
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` set): signup /
  login / organization bootstrap persist to hosted Supabase. The
  marketplace/recovery pipeline still runs on synthetic MOCK fixtures (labelled
  in the UI); connecting a **real** Takealot account additionally requires
  `TAKEALOT_API_KEY` (M14, blocked).

## 3. Hosted Supabase Auth configuration
The app uses Supabase Auth **only** to verify email/password and create the user
row, then mints its **own** signed session cookie (`persistSession:false`). There
are **no** Supabase session tokens, PKCE, OAuth, email-link, or password-reset
flows, and **no `/auth/callback` route**. Configure the hosted project
(Dashboard → Authentication) accordingly:

- **Email provider: ENABLED** (email + password).
- **Confirm email: DISABLED.** *Critical.* Signup returns the user and the app
  immediately treats it as logged in; with confirmations ON, `signInWithPassword`
  fails until the emailed link is clicked, and there is no callback route to
  handle it. (To add real email verification later, first add a callback route +
  redirect URLs — a separate task.)
- **Social OAuth providers: all DISABLED** (none implemented).
- **Site URL:** the primary app URL per environment — `http://localhost:3000`
  locally; the Vercel Preview URL/alias for Preview; `https://recovault.co.za`
  for Production **(add only when that domain is configured — not yet).**
- **Redirect allow-list** (URL Configuration → Redirect URLs) — set for hygiene
  and future flows even though none are exercised today:
  - `http://localhost:3000/**`
  - `https://*.vercel.app/**` (Preview)
  - `https://recovault.co.za/**` (future — add with the production domain)
- **Password reset / callback:** not implemented; do not configure.

Because no redirect-based flow is used, Site URL / Redirect URLs are not on the
functional critical path today — **email/password with "Confirm email" OFF is the
only functionally required setting.**

## 4. Vercel — Preview
Set env vars in **Project → Settings → Environment Variables** (mark the three
secrets **Sensitive**):

| Variable | Environment(s) | Type | Value source |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Preview (+ Production) | plain | `https://fxesioydpmkgbycqsmts.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Preview (+ Production) | plain | hosted anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Preview (+ Production) | **secret** | hosted service_role key |
| `AUTH_SESSION_SECRET` | Preview (+ Production) | **secret** | `openssl rand -base64 32` |
| `MARKETPLACE_ENCRYPTION_KEY` | Preview (+ Production) | **secret** | `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_ENV` | Preview | plain | `preview` |
| `NEXT_PUBLIC_APP_NAME` | all | plain | `RecoVault` |
| `TAKEALOT_API_KEY` | — | — | **not set** (live seller only, M14) |

Deploy (performed by the Vercel account owner — requires Vercel authentication):
```bash
npm i -g vercel
vercel link                 # link this repo to a Vercel project
# add the env vars above (dashboard, or `vercel env add <NAME> preview`)
vercel                      # creates a PREVIEW deployment (NOT --prod)
```

Then run the Preview smoke path: signup → login → organization bootstrap → MOCK
marketplace connect → sync → source records → ledger → Money Finder → accept
candidate → case → evidence PDF → mark submitted → matching recovery → recovered
dashboard total. Auth + org bootstrap persist to hosted Supabase; the pipeline is
MOCK.

### 4.1 Caveat — in-memory pipeline on serverless
The marketplace/recovery pipeline uses a `globalThis` in-memory store (not the
DB) even in LIVE mode. On Vercel's serverless runtime that state is per-instance
and not durable across cold starts / separate invocations, so a single warm
interactive session usually completes the golden loop but automated multi-step
E2E against a Preview can be flaky. Auth + organization bootstrap **do** persist
to hosted Supabase. (Persisting the pipeline to the SQL stores in LIVE mode is a
separate future change.)

## 5. Vercel — Production (future, not yet)
Same matrix with production values and `NEXT_PUBLIC_APP_ENV=production`; add the
`recovault.co.za` Site URL + redirect entry and deploy with `vercel --prod` —
only when the production domain is authorized.

## 6. Build & deploy checks
```bash
npm ci
npm run check   # typecheck + lint + unit + integration + build
```
Security response headers are applied globally via `next.config.mjs`.

## 7. Observability
- Sanitized structured logging (`src/lib/observability`) redacts secret-shaped
  values; nothing sensitive is logged.
- `captureException` is the Sentry-ready boundary — wire a DSN there when Sentry
  is adopted (a later, authorized step).

## 8. Security checklist
- [ ] All required env vars set; secrets not committed; no secret uses a
      `NEXT_PUBLIC_` name (`secret-exposure` e2e proves none reach the bundle).
- [ ] Migrations applied on a clean database; RLS + least-privilege grants
      verified (local and hosted).
- [ ] Supabase Auth: email/password on, **Confirm email off**, no OAuth.
- [ ] Security headers present (`X-Frame-Options`, `X-Content-Type-Options`,
      `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`, HSTS).
- [ ] Dependency audit reviewed (`npm audit`).
- [ ] No claim of live Takealot validation until a real pilot passes.

## 9. Live pilot (Milestone 14)
Live Takealot validation is intentionally **BLOCKED** until a consenting real
seller / API key exists. The mock-validated MVP is complete without it.
