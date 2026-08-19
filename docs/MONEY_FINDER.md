# RecoVault — Money Finder

Status: established at **Milestone 10**. UI under
`src/app/app/org/[orgId]/money-finder/`.

Money Finder is the seller cockpit for deterministic recovery candidates. It
surfaces **potential recovery** without overstating marketplace liability.

## What it shows
- **Overview totals:** potential recovery (exact integer minor units), candidate
  count, and a "requires review" count. Dismissed candidates are excluded from
  the actionable potential-recovery total but remain counted and auditable.
- **Candidate list** with filters by rule, confidence, status, and marketplace.
- **Candidate detail:** rule + version, deterministic confidence (band + score),
  the calculation breakdown, and an **evidence/source trace**
  (candidate → ledger events → source records).
- **Workflow:** `detected → investigating → accepted | dismissed`. Transitions
  are **authorized server-side** (owner/admin) and **audited**; invalid
  transitions are rejected.
- A **MOCK / DEMO banner** is always visible on mock-derived financial screens.

## Language guardrail
Allowed: "potential recovery", "recovery candidate", "anomaly", "requires
review". Forbidden (before verified resolution): "marketplace owes you",
"guaranteed recovery", "guaranteed claim", "confirmed debt". Enforced by a
source-scan unit test.

## MOCK-first pipeline
The running app has no live database, so Money Finder runs the **same
deterministic core** the DB path uses — `MockMarketplaceAdapter → normalize →
recovery rules` — entirely in memory (`src/lib/marketplace/analysis.ts`),
storing candidates in an in-memory store
(`src/lib/marketplace/money-finder-store.ts`). Results are identical to the
PGlite-verified pipeline (`tests/integration/recovery.test.ts`), and money stays
exact integer minor units throughout. The DB-backed `recovery_candidates`
(migration 0006) is the live/tested equivalent.

## Brand
This is the first branded dashboard surface. It applies the registered RecoVault
brand: self-hosted Inter (UI) + Manrope (display) fonts, the navy-first palette
with **restrained gold** (potential-recovery accent only; green is reserved for
verified recovery), the supplied logo via `BrandLogo`, and the favicon.

## Out of scope (later milestones)
Cases (M11), evidence PDF, claim submission tracking, billing.
