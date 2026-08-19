/**
 * Recovery candidate workflow state machine.
 * detected → investigating → accepted | dismissed
 * (a candidate may also be dismissed directly from detected).
 * Terminal: accepted, dismissed. Invalid transitions are rejected.
 */
export const CANDIDATE_STATUSES = [
  "detected",
  "investigating",
  "accepted",
  "dismissed",
] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

const ALLOWED: Record<CandidateStatus, readonly CandidateStatus[]> = {
  detected: ["investigating", "dismissed"],
  investigating: ["accepted", "dismissed"],
  accepted: [],
  dismissed: [],
};

export function canTransition(from: CandidateStatus, to: CandidateStatus): boolean {
  return ALLOWED[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(from: CandidateStatus, to: CandidateStatus) {
    super(`Invalid candidate transition: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(from: CandidateStatus, to: CandidateStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

/** A dismissed or accepted candidate is closed (terminal). */
export function isTerminal(status: CandidateStatus): boolean {
  return status === "accepted" || status === "dismissed";
}

/** Actionable = still contributing to potential recovery (not dismissed). */
export function isActionable(status: CandidateStatus): boolean {
  return status !== "dismissed";
}
