/**
 * Recovery case state machine.
 * draft → evidence_ready → submitted → under_review → accepted | disputed
 *        → payment_expected → recovered | closed
 * A case may be closed from most states. Invalid transitions are rejected.
 */
export const CASE_STATUSES = [
  "draft",
  "evidence_ready",
  "submitted",
  "under_review",
  "accepted",
  "disputed",
  "payment_expected",
  "recovered",
  "closed",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

const ALLOWED: Record<CaseStatus, readonly CaseStatus[]> = {
  draft: ["evidence_ready", "closed"],
  evidence_ready: ["submitted", "closed"],
  submitted: ["under_review", "closed"],
  under_review: ["accepted", "disputed", "closed"],
  accepted: ["payment_expected", "closed"],
  disputed: ["payment_expected", "closed"],
  payment_expected: ["recovered", "closed"],
  recovered: ["closed"],
  closed: [],
};

export function canTransitionCase(from: CaseStatus, to: CaseStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function allowedCaseTransitions(from: CaseStatus): readonly CaseStatus[] {
  return ALLOWED[from];
}

export class InvalidCaseTransitionError extends Error {
  constructor(from: CaseStatus, to: CaseStatus) {
    super(`Invalid case transition: ${from} → ${to}`);
    this.name = "InvalidCaseTransitionError";
  }
}

export function assertTransitionCase(from: CaseStatus, to: CaseStatus): void {
  if (!canTransitionCase(from, to)) throw new InvalidCaseTransitionError(from, to);
}

export function isCaseTerminal(status: CaseStatus): boolean {
  return ALLOWED[status].length === 0;
}
