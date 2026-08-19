import {
  decideMatch,
  isRecoveryPayment,
  reversedPaymentRefs,
  toRecoveryPayment,
  type OpenCaseRef,
} from "@/core/recovery/matching";
import type { LedgerEvent } from "@/core/recovery/types";

export type RecoveryRecordStatus = "matched" | "unmatched" | "reversed" | "needs_review";

export interface RecoveryRecordInput {
  organizationId: string;
  marketplaceAccountId: string;
  marketplaceEventId: string;
  caseId: string | null;
  status: RecoveryRecordStatus;
  amountMinor: number | null;
  currency: string | null;
  externalRef: string | null;
  reason: string | null;
  matchedAt: string | null;
}

export interface RecoveryMatchStore {
  listEvents(accountId: string): Promise<LedgerEvent[]>;
  listOpenCases(accountId: string): Promise<OpenCaseRef[]>;
  upsertRecoveryRecord(input: RecoveryRecordInput): Promise<"inserted" | "unchanged">;
  /** Close a case as recovered — only valid from `payment_expected`. */
  markCaseRecovered(
    caseId: string,
    actorUserId: string | null,
  ): Promise<"recovered" | "skipped">;
}

export interface MatchResult {
  processed: number;
  matched: number;
  unmatched: number;
  reversed: number;
  needsReview: number;
  recovered: number;
}

export interface MatchContext {
  organizationId: string;
  marketplaceAccountId: string;
  actorUserId: string | null;
  now?: string;
}

/**
 * Match recovery/payment events to open cases and persist the outcomes. A valid
 * unreversed single match records a recovery and closes the case (when it is in
 * `payment_expected`). Ambiguous matches are recorded as review-required and
 * never close a case; unmatched payments remain unmatched; reversed payments are
 * recorded as reversed. Deterministic and idempotent (one record per event).
 */
export async function runRecoveryMatching(
  store: RecoveryMatchStore,
  ctx: MatchContext,
): Promise<MatchResult> {
  const now = ctx.now ?? new Date().toISOString();
  const events = await store.listEvents(ctx.marketplaceAccountId);
  const reversed = reversedPaymentRefs(events);
  const openCases = await store.listOpenCases(ctx.marketplaceAccountId);

  const result: MatchResult = {
    processed: 0,
    matched: 0,
    unmatched: 0,
    reversed: 0,
    needsReview: 0,
    recovered: 0,
  };

  for (const event of events) {
    if (!isRecoveryPayment(event)) continue;
    result.processed += 1;
    const payment = toRecoveryPayment(event);
    const decision = decideMatch(payment, reversed, openCases);

    let status: RecoveryRecordStatus;
    let caseId: string | null = null;
    let reason: string | null = null;

    switch (decision.kind) {
      case "matched":
        status = "matched";
        caseId = decision.caseId;
        result.matched += 1;
        break;
      case "reversed":
        status = "reversed";
        caseId = decision.caseId;
        reason = "Matching reimbursement was reversed";
        result.reversed += 1;
        break;
      case "needs_review":
        status = "needs_review";
        reason = `Ambiguous: matches cases ${decision.caseIds.join(", ")}`;
        result.needsReview += 1;
        break;
      case "unmatched":
        status = "unmatched";
        result.unmatched += 1;
        break;
    }

    await store.upsertRecoveryRecord({
      organizationId: ctx.organizationId,
      marketplaceAccountId: ctx.marketplaceAccountId,
      marketplaceEventId: payment.eventId,
      caseId,
      status,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      externalRef: payment.relatedExternalId,
      reason,
      matchedAt: status === "matched" ? now : null,
    });

    // Close the loop only for a valid match on a case awaiting payment.
    if (decision.kind === "matched") {
      const outcome = await store.markCaseRecovered(decision.caseId, ctx.actorUserId);
      if (outcome === "recovered") result.recovered += 1;
    }
  }

  return result;
}
