# RecoVault — Deployment Runbook

Target platform: **Vercel** (Next.js App Router). Database & auth: **Supabase**.

## 1. Provision Supabase
1. Create a Supabase project.
2. Apply the SQL migrations in order — they are the single schema source of
   truth (`supabase/migrations/0001_…` … `0010_…`), e.g. via the Supabase CLI:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```
   Migrations create all tenant tables with Row-Level Security enabled and
   depend only on the Supabase-provided `auth` schema and roles.

## 2. Configure environment
Set every variable from `.env.example` in the deployment environment. Required
in production (`REQUIRED_PRODUCTION_ENV`):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable)
- `SUPABASE_SERVICE_ROLE_KEY` (secret, server-only — bypasses RLS)
- `AUTH_SESSION_SECRET` (≥16 chars; `openssl rand -base64 32`)
- `MARKETPLACE_ENCRYPTION_KEY` (32-byte base64/hex; `openssl rand -base64 32`)

`TAKEALOT_API_KEY` is only needed once a **real, authorized** seller connects a
LIVE marketplace. It must never be committed or exposed to the client.

Call `validateProductionEnv()` at startup to fail closed on any missing value.

## 3. Build & deploy
```bash
npm ci
npm run check   # typecheck + lint + unit + integration + build
npm run build
```
Deploy to Vercel (or run `npm run start` behind a process manager). Security
response headers are applied globally via `next.config.mjs`.

## 4. Modes
- **MOCK** (default when the Supabase trio is unset): in-memory auth + synthetic
  marketplace data. Safe for demos; never presents mock data as real recovery.
- **LIVE**: set the Supabase variables to persist to the database. Connecting a
  real Takealot account additionally requires `TAKEALOT_API_KEY`.

## 5. Observability
- Sanitized structured logging (`src/lib/observability`) redacts secret-shaped
  values; nothing sensitive is logged.
- `captureException` is the Sentry-ready boundary — wire a DSN there when Sentry
  is adopted (a later, authorized step).

## 6. Security checklist
- [ ] All required env vars set; secrets not committed.
- [ ] Migrations applied on a clean database; RLS verified.
- [ ] Security headers present (`X-Frame-Options`, `X-Content-Type-Options`,
      `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`, HSTS).
- [ ] Dependency audit reviewed (`npm audit`).
- [ ] No claim of live Takealot validation until a real pilot passes.

## 7. Live pilot (Milestone 14)
Live Takealot validation is intentionally **BLOCKED** until a consenting real
seller / API key exists. The mock-validated MVP is complete without it.
