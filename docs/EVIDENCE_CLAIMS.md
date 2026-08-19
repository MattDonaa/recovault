# RecoVault — Evidence Pack & Manual Claim Tracking

Status: established at **Milestone 12**. Core: `src/core/evidence/`,
`src/core/claims/`. PDF: `src/lib/evidence/pdf.ts`.

## Evidence pack
A deterministic snapshot built **only** from persisted case/candidate/source
data — no fabrication, no LLM. `buildEvidencePack` is pure: it returns exactly
the persisted values plus a `generatedAt` timestamp and a fixed disclaimer.

Minimum content (all from stored data): case ID, marketplace/account, issue &
rule type, SKU/order/shipment/return references, timeline, quantities, **exact
monetary calculation** (integer minor units), source-evidence references,
confidence + rule version, generated-at, and the disclaimer that the candidate
is evidence-based and **not a guarantee of marketplace liability**.

### PDF
`renderEvidencePdf(pack)` produces a server-generated PDF with `pdf-lib`
(offline — no CDN fonts). Route: `GET /app/org/[orgId]/cases/[caseId]/evidence`
requires an authenticated org member; a non-member or cross-tenant case gets a
404. The case detail page is itself a printable evidence summary.

## Manual claim tracking
Sellers submit claims to the marketplace **manually**; RecoVault only tracks
that. Migration 0008 adds to `cases`: `external_reference`, `submitted_at`,
`submission_deadline_at`, `dispute_sla_deadline_at`.

`submitCase` (`src/core/claims/submit.ts`) marks a case `submitted` — requiring
a non-empty external reference and a valid submission date — sets both deadline
clocks, and records a `submitted` audit event. Submitting is only valid from
`evidence_ready` (state machine enforced).

## Deadlines / SLA — two separate clocks
`src/core/claims/deadlines.ts`, driven by explicit `ClaimConfig`:
- **Submission deadline** — anchored on **discovery** (case created),
  `computeSubmissionDeadline`.
- **Dispute-resolution SLA** — anchored on **submission**, `computeDisputeSla`.

They use different anchors and separate functions, so they cannot be conflated.
`countdown(deadline, now)` derives days-remaining / overdue.

## Guardrails
- No LLM is required or used; if narrative were added later it could only
  summarize verified facts and never alter calculations/evidence.
- No unsupported claim language (enforced by test): no "owes you", "guaranteed",
  or "confirmed debt".
- **No automatic submission** anywhere — no marketplace submission, no browser
  automation. Enforced by a source-scan test (AC-05).

## Out of scope
Automatic marketplace claim submission; seller-portal browser automation;
LLM-based financial decisions.
