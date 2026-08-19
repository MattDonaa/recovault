import { randomUUID } from "node:crypto";

import type { DetectedCandidate, LedgerEvent } from "@/core/recovery/types";
import { assertTransition, type CandidateStatus } from "@/core/recovery/workflow";
import { analyzeScenario } from "@/lib/marketplace/analysis";
import { getConnection } from "@/lib/marketplace/mock-accounts";

/**
 * In-memory Money Finder store (MOCK-FIRST). Holds candidates produced by the
 * deterministic analysis pipeline plus their evidence events, and records audit
 * entries for material state changes. The DB-backed path (recovery_candidates)
 * is the live/tested equivalent; this is the offline app store.
 */
export interface StoredCandidate extends DetectedCandidate {
  id: string;
  organizationId: string;
  marketplaceAccountId: string;
  marketplace: string;
  status: CandidateStatus;
  detectedAt: string;
}

interface AuditEntry {
  organizationId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
}

interface Store {
  candidates: StoredCandidate[];
  events: Record<string, LedgerEvent[]>;
  audit: AuditEntry[];
}

const GLOBAL_KEY = "__recovault_money_finder__";

function store(): Store {
  const g = globalThis as unknown as Record<string, Store | undefined>;
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = { candidates: [], events: {}, audit: [] };
  return g[GLOBAL_KEY]!;
}

export function resetMoneyFinder(): void {
  const s = store();
  s.candidates.length = 0;
  s.events = {};
  s.audit.length = 0;
}

export function moneyFinderAudit(): ReadonlyArray<AuditEntry> {
  return store().audit;
}

/**
 * Run analysis for a MOCK connection: produce candidates + evidence and store
 * them (replacing any prior candidates for that connection). Returns the number
 * of candidates detected.
 */
export async function analyzeConnection(
  organizationId: string,
  connectionId: string,
): Promise<number> {
  const connection = getConnection(organizationId, connectionId);
  if (!connection) throw new Error("Connection not found");
  if (connection.mode !== "mock" || !connection.scenarioKey) {
    throw new Error("Analysis is only available for mock connections");
  }

  const { events, candidates } = await analyzeScenario(connection.scenarioKey);
  const s = store();
  s.candidates = s.candidates.filter((c) => c.marketplaceAccountId !== connectionId);
  s.events[connectionId] = events;

  for (const candidate of candidates) {
    s.candidates.push({
      ...candidate,
      id: randomUUID(),
      organizationId,
      marketplaceAccountId: connectionId,
      marketplace: connection.marketplace,
      status: "detected",
      detectedAt: new Date().toISOString(),
    });
  }
  s.audit.push({
    organizationId,
    action: "money_finder.analysis_run",
    entityType: "marketplace_account",
    entityId: connectionId,
    createdAt: new Date().toISOString(),
  });
  return candidates.length;
}

export function listOrgCandidates(organizationId: string): StoredCandidate[] {
  return store().candidates.filter((c) => c.organizationId === organizationId);
}

/** Find a stored candidate by id (any org). Authorization is done by callers. */
export function findStoredCandidate(candidateId: string): StoredCandidate | null {
  return store().candidates.find((c) => c.id === candidateId) ?? null;
}

export interface CandidateFilter {
  rule?: string;
  confidence?: string;
  status?: string;
  marketplace?: string;
}

/** Pure filter over candidates. Empty/absent filter values match everything. */
export function filterCandidates(
  candidates: StoredCandidate[],
  filter: CandidateFilter,
): StoredCandidate[] {
  return candidates.filter(
    (c) =>
      (!filter.rule || c.ruleId === filter.rule) &&
      (!filter.confidence || c.confidence === filter.confidence) &&
      (!filter.status || c.status === filter.status) &&
      (!filter.marketplace || c.marketplace === filter.marketplace),
  );
}

export function getCandidate(
  organizationId: string,
  candidateId: string,
): { candidate: StoredCandidate; evidence: { role: string; event: LedgerEvent }[] } | null {
  const candidate = store().candidates.find(
    (c) => c.organizationId === organizationId && c.id === candidateId,
  );
  if (!candidate) return null;
  const events = store().events[candidate.marketplaceAccountId] ?? [];
  const evidence = candidate.evidence.flatMap((link) => {
    const event = events.find((e) => e.id === link.eventId);
    return event ? [{ role: link.role, event }] : [];
  });
  return { candidate, evidence };
}

/** Apply a workflow transition (validated) and record an audit entry. */
export function transitionCandidate(
  organizationId: string,
  candidateId: string,
  to: CandidateStatus,
): void {
  const candidate = store().candidates.find(
    (c) => c.organizationId === organizationId && c.id === candidateId,
  );
  if (!candidate) throw new Error("Candidate not found");
  assertTransition(candidate.status, to); // throws on invalid transition
  candidate.status = to;
  store().audit.push({
    organizationId,
    action: `recovery_candidate.${to}`,
    entityType: "recovery_candidate",
    entityId: candidateId,
    createdAt: new Date().toISOString(),
  });
}
