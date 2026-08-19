import { describe, expect, it } from "vitest";

import {
  computeDisputeSla,
  computeSubmissionDeadline,
  countdown,
  DEFAULT_CLAIM_CONFIG,
} from "@/core/claims/deadlines";

describe("claim deadlines", () => {
  it("anchors the submission deadline on discovery", () => {
    const deadline = computeSubmissionDeadline("2026-01-01T00:00:00.000Z", {
      submissionWindowDays: 30,
      disputeSlaDays: 14,
    });
    expect(deadline).toBe("2026-01-31T00:00:00.000Z");
  });

  it("anchors the dispute SLA on submission (a separate clock)", () => {
    const sla = computeDisputeSla("2026-01-10T00:00:00.000Z", DEFAULT_CLAIM_CONFIG);
    expect(sla).toBe("2026-01-24T00:00:00.000Z");
  });

  it("the two clocks cannot be conflated (different anchors → different results)", () => {
    const discoveredAt = "2026-01-01T00:00:00.000Z";
    const submittedAt = "2026-01-10T00:00:00.000Z";
    const submission = computeSubmissionDeadline(discoveredAt);
    const sla = computeDisputeSla(submittedAt);
    expect(submission).not.toBe(sla);
    // Swapping the anchors changes each result → they are independent clocks.
    expect(computeSubmissionDeadline(submittedAt)).not.toBe(submission);
    expect(computeDisputeSla(discoveredAt)).not.toBe(sla);
  });

  it("counts down with correct boundaries", () => {
    const deadline = "2026-02-01T00:00:00.000Z";
    // Exactly at the deadline: 0 remaining, not overdue.
    expect(countdown(deadline, "2026-02-01T00:00:00.000Z")).toMatchObject({
      daysRemaining: 0,
      overdue: false,
    });
    // One ms past: overdue.
    expect(countdown(deadline, "2026-02-01T00:00:00.001Z")!.overdue).toBe(true);
    // Ten days before: 10 remaining.
    expect(countdown(deadline, "2026-01-22T00:00:00.000Z")!.daysRemaining).toBe(10);
    expect(countdown(null, "2026-02-01T00:00:00.000Z")).toBeNull();
  });
});
