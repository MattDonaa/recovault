import { randomUUID } from "node:crypto";

import type { CaseStatus } from "@/core/cases/status";
import type {
  CandidateForCase,
  CaseEventInput,
  CaseEventRecord,
  CaseRecord,
  CaseStore,
  CreateCaseInput,
  EvidenceRef,
} from "@/core/cases/types";
import { findStoredCandidate } from "@/lib/marketplace/money-finder-store";

interface EvidenceRow extends EvidenceRef {
  caseId: string;
}
interface Store {
  cases: CaseRecord[];
  events: CaseEventRecord[];
  evidence: EvidenceRow[];
}

const GLOBAL_KEY = "__recovault_cases__";

function store(): Store {
  const g = globalThis as unknown as Record<string, Store | undefined>;
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = { cases: [], events: [], evidence: [] };
  return g[GLOBAL_KEY]!;
}

export function resetCases(): void {
  const s = store();
  s.cases.length = 0;
  s.events.length = 0;
  s.evidence.length = 0;
}

export function listCaseEvents(caseId: string): CaseEventRecord[] {
  return store()
    .events.filter((e) => e.caseId === caseId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function listCaseEvidence(caseId: string): EvidenceRef[] {
  return store().evidence.filter((e) => e.caseId === caseId);
}

export function getCaseById(caseId: string): CaseRecord | null {
  return store().cases.find((c) => c.id === caseId) ?? null;
}

export function findCaseByCandidateId(candidateId: string): CaseRecord | null {
  return store().cases.find((c) => c.recoveryCandidateId === candidateId) ?? null;
}

export function listOrgCases(organizationId: string): CaseRecord[] {
  return store()
    .cases.filter((c) => c.organizationId === organizationId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** In-memory CaseStore (MOCK-FIRST app path). */
export function createInMemoryCaseStore(): CaseStore {
  return {
    async getCandidate(candidateId: string): Promise<CandidateForCase | null> {
      const c = findStoredCandidate(candidateId);
      if (!c) return null;
      return {
        id: c.id,
        organizationId: c.organizationId,
        marketplaceAccountId: c.marketplaceAccountId,
        status: c.status,
        title: c.title,
        summary: c.summary,
        potentialRecoveryMinor: c.potentialRecoveryMinor,
        currency: c.currency,
        ruleId: c.ruleId,
        ruleVersion: c.ruleVersion,
        evidence: c.evidence.map((e) => ({ eventId: e.eventId, role: e.role })),
      };
    },

    async findCaseByCandidate(candidateId: string): Promise<CaseRecord | null> {
      return store().cases.find((c) => c.recoveryCandidateId === candidateId) ?? null;
    },

    async createCase(input: CreateCaseInput): Promise<{ case: CaseRecord; created: boolean }> {
      const existing = store().cases.find(
        (c) => c.recoveryCandidateId === input.recoveryCandidateId,
      );
      if (existing) return { case: existing, created: false };
      const record: CaseRecord = {
        id: randomUUID(),
        organizationId: input.organizationId,
        marketplaceAccountId: input.marketplaceAccountId,
        recoveryCandidateId: input.recoveryCandidateId,
        status: "draft",
        title: input.title,
        summary: input.summary,
        potentialRecoveryMinor: input.potentialRecoveryMinor,
        currency: input.currency,
        ruleId: input.ruleId,
        ruleVersion: input.ruleVersion,
        createdAt: new Date().toISOString(),
      };
      store().cases.push(record);
      return { case: record, created: true };
    },

    async addEvidenceRefs(caseId, organizationId, refs): Promise<void> {
      void organizationId;
      for (const ref of refs) {
        const dup = store().evidence.some(
          (e) => e.caseId === caseId && e.eventId === ref.eventId && e.role === ref.role,
        );
        if (!dup) store().evidence.push({ caseId, eventId: ref.eventId, role: ref.role });
      }
    },

    async addCaseEvent(event: CaseEventInput): Promise<void> {
      store().events.push({
        ...event,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      });
    },

    async getCase(caseId: string): Promise<CaseRecord | null> {
      return store().cases.find((c) => c.id === caseId) ?? null;
    },

    async updateCaseStatus(caseId: string, to: CaseStatus): Promise<void> {
      const c = store().cases.find((x) => x.id === caseId);
      if (c) c.status = to;
    },

    async listCases(organizationId: string): Promise<CaseRecord[]> {
      return store()
        .cases.filter((c) => c.organizationId === organizationId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  };
}
