/**
 * Claim deadline / SLA clocks. The claim-submission deadline and the
 * dispute-resolution SLA are DISTINCT clocks anchored on different events and
 * computed by separate functions, so they can never be conflated. Durations
 * come from explicit configuration.
 */
export interface ClaimConfig {
  /** Days from discovery within which a claim should be submitted. */
  submissionWindowDays: number;
  /** Days from submission within which the dispute should resolve. */
  disputeSlaDays: number;
}

export const DEFAULT_CLAIM_CONFIG: ClaimConfig = {
  submissionWindowDays: 30,
  disputeSlaDays: 14,
};

const DAY_MS = 86_400_000;

function addDays(iso: string, days: number): string {
  const base = Date.parse(iso);
  if (Number.isNaN(base)) throw new Error(`Invalid date: ${iso}`);
  return new Date(base + days * DAY_MS).toISOString();
}

/** Submission deadline — anchored on discovery (when the case was created). */
export function computeSubmissionDeadline(
  discoveredAt: string,
  config: ClaimConfig = DEFAULT_CLAIM_CONFIG,
): string {
  return addDays(discoveredAt, config.submissionWindowDays);
}

/** Dispute-resolution SLA deadline — anchored on submission. Separate clock. */
export function computeDisputeSla(
  submittedAt: string,
  config: ClaimConfig = DEFAULT_CLAIM_CONFIG,
): string {
  return addDays(submittedAt, config.disputeSlaDays);
}

export interface Countdown {
  deadlineAt: string;
  daysRemaining: number;
  overdue: boolean;
}

/** Countdown for a single deadline relative to `now`. Null when no deadline. */
export function countdown(deadlineAt: string | null, now: string): Countdown | null {
  if (!deadlineAt) return null;
  const remainingMs = Date.parse(deadlineAt) - Date.parse(now);
  return {
    deadlineAt,
    daysRemaining: Math.floor(remainingMs / DAY_MS),
    overdue: remainingMs < 0,
  };
}
