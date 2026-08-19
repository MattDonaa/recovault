import type { CandidateStatus } from "@/core/recovery/workflow";
import type { Confidence } from "@/core/recovery/types";

/** The subset of a candidate needed to compute overview totals. */
export interface CandidateSummary {
  ruleId: string;
  confidence: Confidence;
  status: CandidateStatus;
  potentialRecoveryMinor: number | null;
  currency: string | null;
}

export interface RecoveryTotals {
  candidateCount: number;
  actionableCount: number;
  dismissedCount: number;
  /** Sum of potential recovery over actionable (non-dismissed) candidates. */
  potentialRecoveryMinor: number;
  currency: string | null;
  byRule: Record<string, number>;
  byConfidence: Record<Confidence, number>;
  byStatus: Record<CandidateStatus, number>;
}

/**
 * Exact overview totals from persisted candidates. Money is summed in integer
 * minor units (no floating point). Dismissed candidates are excluded from the
 * actionable potential-recovery total but remain counted (auditable).
 */
export function computeTotals(candidates: CandidateSummary[]): RecoveryTotals {
  const totals: RecoveryTotals = {
    candidateCount: candidates.length,
    actionableCount: 0,
    dismissedCount: 0,
    potentialRecoveryMinor: 0,
    currency: null,
    byRule: {},
    byConfidence: { HIGH: 0, MEDIUM: 0, LOW: 0 },
    byStatus: { detected: 0, investigating: 0, accepted: 0, dismissed: 0 },
  };

  for (const c of candidates) {
    totals.byRule[c.ruleId] = (totals.byRule[c.ruleId] ?? 0) + 1;
    totals.byConfidence[c.confidence] += 1;
    totals.byStatus[c.status] += 1;

    if (c.status === "dismissed") {
      totals.dismissedCount += 1;
    } else {
      totals.actionableCount += 1;
      if (c.potentialRecoveryMinor !== null) {
        totals.potentialRecoveryMinor += c.potentialRecoveryMinor;
        if (totals.currency === null) totals.currency = c.currency;
      }
    }
  }
  return totals;
}
