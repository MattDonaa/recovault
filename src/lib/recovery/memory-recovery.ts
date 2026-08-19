import { randomUUID } from "node:crypto";

import type {
  RecoveryMatchStore,
  RecoveryRecordInput,
} from "@/core/recovery/match-engine";
import type { OpenCaseRef } from "@/core/recovery/matching";
import type { LedgerEvent } from "@/core/recovery/types";
import {
  createInMemoryCaseStore,
  getCaseById,
  listCasesByAccount,
} from "@/lib/cases/memory-store";
import {
  appendAccountEvents,
  findStoredCandidate,
  getAccountEvents,
} from "@/lib/marketplace/money-finder-store";

export interface StoredRecoveryRecord extends RecoveryRecordInput {
  id: string;
  createdAt: string;
}

const GLOBAL_KEY = "__recovault_recovery_records__";

function records(): StoredRecoveryRecord[] {
  const g = globalThis as unknown as Record<string, StoredRecoveryRecord[] | undefined>;
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = [];
  return g[GLOBAL_KEY]!;
}

export function resetRecoveryRecords(): void {
  records().length = 0;
}

export function listRecoveryRecords(organizationId: string): StoredRecoveryRecord[] {
  return records().filter((r) => r.organizationId === organizationId);
}

/** Total verified (matched, unreversed) recovered amount for an org. */
export function recoveredTotalMinor(organizationId: string): number {
  return records()
    .filter((r) => r.organizationId === organizationId && r.status === "matched")
    .reduce((sum, r) => sum + (r.amountMinor ?? 0), 0);
}

/** In-memory recovery-matching store (MOCK-first app path). */
export function createInMemoryMatchStore(): RecoveryMatchStore {
  return {
    async listEvents(accountId: string): Promise<LedgerEvent[]> {
      return getAccountEvents(accountId);
    },

    async listOpenCases(accountId: string): Promise<OpenCaseRef[]> {
      return listCasesByAccount(accountId)
        .filter((c) => c.status !== "recovered" && c.status !== "closed")
        .flatMap((c) => {
          const candidate = findStoredCandidate(c.recoveryCandidateId);
          const lossRef = candidate?.externalRef;
          return lossRef ? [{ caseId: c.id, lossRef, status: c.status }] : [];
        });
    },

    async upsertRecoveryRecord(input: RecoveryRecordInput): Promise<"inserted" | "unchanged"> {
      const dup = records().some(
        (r) =>
          r.marketplaceAccountId === input.marketplaceAccountId &&
          r.marketplaceEventId === input.marketplaceEventId,
      );
      if (dup) return "unchanged";
      records().push({ ...input, id: randomUUID(), createdAt: new Date().toISOString() });
      return "inserted";
    },

    async markCaseRecovered(
      caseId: string,
      actorUserId: string | null,
    ): Promise<"recovered" | "skipped"> {
      const record = getCaseById(caseId);
      if (!record || record.status !== "payment_expected") return "skipped";
      const store = createInMemoryCaseStore();
      await store.updateCaseStatus(caseId, "recovered");
      await store.addCaseEvent({
        organizationId: record.organizationId,
        caseId,
        actorUserId,
        eventType: "transition",
        fromStatus: "payment_expected",
        toStatus: "recovered",
        reason: "Recovery matched and verified",
        correlationId: null,
      });
      return "recovered";
    },
  };
}

/**
 * DEMO ONLY: ingest a synthetic matching recovery/payment event for a case's
 * loss reference, so the mock end-to-end loop can be closed without a real
 * marketplace. Clearly a mock affordance — real recoveries arrive via sync.
 */
export function ingestDemoRecovery(
  accountId: string,
  lossRef: string,
  amountMinor: number | null,
  currency: string | null,
): void {
  const suffix = randomUUID().slice(0, 8);
  const event: LedgerEvent = {
    id: `evt:recovery:${lossRef}:${suffix}`,
    eventType: "payment",
    externalRef: `recovery-${lossRef}-${suffix}`,
    sku: null,
    orderExternalId: null,
    references: { canonicalType: "reimbursement", relatedExternalId: lossRef },
    quantity: null,
    amountMinor,
    currency,
    occurredAt: new Date().toISOString(),
    eventKey: `transaction:recovery-${lossRef}-${suffix}`,
    sourceRecordId: "demo-recovery",
  };
  appendAccountEvents(accountId, [event]);
}
