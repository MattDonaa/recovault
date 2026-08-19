import { describe, expect, it } from "vitest";

import { decideMatch, type OpenCaseRef, type RecoveryPayment } from "@/core/recovery/matching";

const payment = (over: Partial<RecoveryPayment> = {}): RecoveryPayment => ({
  eventId: "evt-1",
  externalRef: "txn-1",
  relatedExternalId: "shp-1",
  amountMinor: 99500,
  currency: "ZAR",
  ...over,
});

const openCase = (id: string, lossRef: string): OpenCaseRef => ({
  caseId: id,
  lossRef,
  status: "payment_expected",
});

describe("recovery matching decisions", () => {
  it("matches a single open case by canonical identifier", () => {
    const d = decideMatch(payment(), new Set(), [openCase("case-1", "shp-1")]);
    expect(d).toEqual({ kind: "matched", caseId: "case-1" });
  });

  it("does not close a case when the payment was reversed", () => {
    const d = decideMatch(payment(), new Set(["txn-1"]), [openCase("case-1", "shp-1")]);
    expect(d).toEqual({ kind: "reversed", caseId: "case-1" });
  });

  it("requires review when more than one case matches (never silently closes)", () => {
    const d = decideMatch(payment(), new Set(), [
      openCase("case-1", "shp-1"),
      openCase("case-2", "shp-1"),
    ]);
    expect(d).toEqual({ kind: "needs_review", caseIds: ["case-1", "case-2"] });
  });

  it("leaves a payment unmatched when no case matches", () => {
    expect(decideMatch(payment(), new Set(), [openCase("case-1", "other")])).toEqual({
      kind: "unmatched",
    });
    expect(decideMatch(payment({ relatedExternalId: null }), new Set(), [openCase("case-1", "shp-1")])).toEqual({
      kind: "unmatched",
    });
  });
});
