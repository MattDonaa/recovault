# RecoVault — Recovery Rules (V1)

Status: established at **Milestone 09**. Rules: `src/core/recovery/rules/`.
Candidates: `supabase/migrations/0006_recovery_candidates.sql`.

Recovery detection is **deterministic and rule-based** — no LLM determines
liability, anomaly existence, recovery amount, confidence, or eligibility. Each
rule is versioned and operates only on the canonical ledger
(`marketplace_events`), so it never depends on a marketplace's DTOs. Every
candidate is explainable: candidate → linked ledger events → source records →
rule + calculation inputs. Money is exact integer minor units (never float).

Candidate language is always "recovery candidate", "potential recovery", or
"anomaly" — never "owed" or "guaranteed".

## Confidence bands
Deterministic score → band: **HIGH** ≥ 80, **MEDIUM** 50–79, **LOW** < 50.

## Candidate state machine
`detected → investigating → accepted | dismissed` (transitions handled in later
milestones; the engine only emits `detected`).

---

## MR-001 — Inbound Shipment Discrepancy (`MR-001:v1`)
- **Concept:** `unaccounted = quantity_sent − quantity_received − quantity_damaged`.
- **Required evidence:** a `shipment_item` event with **all three** quantity
  fields present. Absent fields are never treated as zero.
- **Disqualifiers:** shipment status `resolved`; `unaccounted ≤ 0`.
- **Candidate when:** evidence complete, status ≠ resolved, `unaccounted > 0`.
- **Score / confidence:** 90 / **HIGH**.
- **Valuation:** `potential_recovery = unaccounted × unit_cost`. Unit cost is not
  present in the ledger, so the amount is recorded as **null** (quantity-based
  evidence) pending price linkage; `unaccounted` is the deterministic figure.
- **Explanation:** the shipment event and its computed unaccounted quantity.

## MR-002 — Return Financial / Outcome Mismatch (`MR-002:v1`)
- **Permitted predicate (only one enabled):** a `return` with outcome
  `refunded` for which **no** matching refund exists (a `charge` event with
  `canonicalType = refund` whose `relatedExternalId` equals the return's
  external ref).
- **Required evidence:** a return event with a concrete outcome.
- **Disqualifier:** a matching refund transaction exists.
- **Score / confidence:** 60 / **MEDIUM** — the contradiction is real but its
  resolution is ambiguous, so it can never be HIGH. Not generalized beyond this
  predicate.
- **Amount:** the disputed refund magnitude (`|return.amount|`) when known.
- **Explanation:** the return event and the absence of a matching refund.

## MR-003 — Stock-Loss Event Without Matching Recovery (`MR-003:v1`)
- **Verified loss reference:** a `shipment_item` event with
  `quantity_damaged > 0`.
- **Matching recovery:** a `payment` event whose `relatedExternalId` equals the
  loss shipment's external ref.
- **Reversal handling:** a payment reversed by a later `reversal` event (whose
  `relatedExternalId` equals the payment's external ref) is **not** a valid
  recovery.
- **Candidate when:** a verified loss has **no valid (unreversed)** matching
  payment (never reimbursed, or reimbursed-then-reversed).
- **Disqualifier:** a valid unreversed matching payment exists.
- **Score / confidence:** 90 / **HIGH** when never reimbursed; 88 / **HIGH** when
  a reimbursement was reversed.
- **Amount:** the reversed reimbursement amount when known, otherwise **null**
  (quantity-based).
- **Explanation:** the loss shipment event, plus the reversed payment and its
  reversal when applicable.

---

## Idempotency & versioning
Each candidate has a deterministic `candidate_key`
(`<rule>:<event_key>`), unique per account. Insertion is
`ON CONFLICT DO NOTHING`, so re-running the engine creates no duplicates. The
`rule_version` is persisted on every candidate.

## Fixture expectations (manifest-verified)
| Scenario | Candidate |
|---|---|
| shipment-discrepancy | MR-001, HIGH, quantity-based |
| return-mismatch | MR-002, MEDIUM, R199.00 |
| stock-loss-unpaid | MR-003, HIGH, quantity-based |
| payment-reversal | MR-003, HIGH, R995.00 (reversed) |
| healthy, resolved-shipment, consistent-return, stock-loss-paid, duplicate-retry, malformed-payload, empty-account, large-account | none |
