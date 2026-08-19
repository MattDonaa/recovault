import type { CaseStatus } from "@/core/cases/status";
import type {
  CandidateForCase,
  CaseEventInput,
  CaseRecord,
  CaseStore,
  CreateCaseInput,
  EvidenceRef,
} from "@/core/cases/types";
import type { SqlExec } from "@/lib/ingestion/sql-store";

interface CaseRow {
  id: string;
  organization_id: string;
  marketplace_account_id: string;
  recovery_candidate_id: string;
  status: CaseStatus;
  title: string;
  summary: string;
  potential_recovery_minor: string | number | null;
  currency: string | null;
  rule_id: string;
  rule_version: string;
  created_at: string;
}

function toCase(r: CaseRow): CaseRecord {
  return {
    id: r.id,
    organizationId: r.organization_id,
    marketplaceAccountId: r.marketplace_account_id,
    recoveryCandidateId: r.recovery_candidate_id,
    status: r.status,
    title: r.title,
    summary: r.summary,
    potentialRecoveryMinor: r.potential_recovery_minor === null ? null : Number(r.potential_recovery_minor),
    currency: r.currency,
    ruleId: r.rule_id,
    ruleVersion: r.rule_version,
    createdAt: String(r.created_at),
  };
}

const CASE_COLUMNS = `id, organization_id, marketplace_account_id, recovery_candidate_id,
  status, title, summary, potential_recovery_minor, currency, rule_id, rule_version, created_at`;

export function createSqlCaseStore(exec: SqlExec): CaseStore {
  return {
    async getCandidate(candidateId: string): Promise<CandidateForCase | null> {
      const res = await exec.query<{
        id: string;
        organization_id: string;
        marketplace_account_id: string;
        status: string;
        title: string;
        summary: string;
        potential_recovery_minor: string | number | null;
        currency: string | null;
        rule_id: string;
        rule_version: string;
      }>(
        `select id, organization_id, marketplace_account_id, status, title, summary,
                potential_recovery_minor, currency, rule_id, rule_version
         from public.recovery_candidates where id = $1`,
        [candidateId],
      );
      const c = res.rows[0];
      if (!c) return null;
      const ev = await exec.query<{ marketplace_event_id: string; role: string }>(
        `select marketplace_event_id, role from public.recovery_candidate_evidence
         where recovery_candidate_id = $1`,
        [candidateId],
      );
      return {
        id: c.id,
        organizationId: c.organization_id,
        marketplaceAccountId: c.marketplace_account_id,
        status: c.status,
        title: c.title,
        summary: c.summary,
        potentialRecoveryMinor:
          c.potential_recovery_minor === null ? null : Number(c.potential_recovery_minor),
        currency: c.currency,
        ruleId: c.rule_id,
        ruleVersion: c.rule_version,
        evidence: ev.rows.map((r) => ({ eventId: r.marketplace_event_id, role: r.role })),
      };
    },

    async findCaseByCandidate(candidateId: string): Promise<CaseRecord | null> {
      const res = await exec.query<CaseRow>(
        `select ${CASE_COLUMNS} from public.cases where recovery_candidate_id = $1`,
        [candidateId],
      );
      return res.rows[0] ? toCase(res.rows[0]) : null;
    },

    async createCase(input: CreateCaseInput): Promise<{ case: CaseRecord; created: boolean }> {
      const inserted = await exec.query<CaseRow>(
        `insert into public.cases (
           organization_id, marketplace_account_id, recovery_candidate_id,
           title, summary, potential_recovery_minor, currency, rule_id, rule_version, created_by
         ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (recovery_candidate_id) do nothing
         returning ${CASE_COLUMNS}`,
        [
          input.organizationId,
          input.marketplaceAccountId,
          input.recoveryCandidateId,
          input.title,
          input.summary,
          input.potentialRecoveryMinor,
          input.currency,
          input.ruleId,
          input.ruleVersion,
          input.createdBy,
        ],
      );
      if (inserted.rows[0]) return { case: toCase(inserted.rows[0]), created: true };
      // Conflict → return the existing case.
      const existing = await exec.query<CaseRow>(
        `select ${CASE_COLUMNS} from public.cases where recovery_candidate_id = $1`,
        [input.recoveryCandidateId],
      );
      return { case: toCase(existing.rows[0]!), created: false };
    },

    async addEvidenceRefs(caseId, organizationId, refs: EvidenceRef[]): Promise<void> {
      for (const ref of refs) {
        await exec.query(
          `insert into public.case_evidence_refs (organization_id, case_id, marketplace_event_id, role)
           values ($1, $2, $3, $4)
           on conflict (case_id, marketplace_event_id, role) do nothing`,
          [organizationId, caseId, ref.eventId, ref.role],
        );
      }
    },

    async addCaseEvent(event: CaseEventInput): Promise<void> {
      await exec.query(
        `insert into public.case_events (
           organization_id, case_id, actor_user_id, event_type, from_status,
           to_status, reason, metadata, correlation_id
         ) values ($1, $2, $3, $4, $5::public.case_status, $6::public.case_status, $7, $8::jsonb, $9)`,
        [
          event.organizationId,
          event.caseId,
          event.actorUserId,
          event.eventType,
          event.fromStatus,
          event.toStatus,
          event.reason,
          JSON.stringify(event.metadata ?? {}),
          event.correlationId,
        ],
      );
    },

    async getCase(caseId: string): Promise<CaseRecord | null> {
      const res = await exec.query<CaseRow>(
        `select ${CASE_COLUMNS} from public.cases where id = $1`,
        [caseId],
      );
      return res.rows[0] ? toCase(res.rows[0]) : null;
    },

    async updateCaseStatus(caseId: string, to: CaseStatus): Promise<void> {
      await exec.query(
        `update public.cases set status = $2::public.case_status where id = $1`,
        [caseId, to],
      );
    },

    async listCases(organizationId: string): Promise<CaseRecord[]> {
      const res = await exec.query<CaseRow>(
        `select ${CASE_COLUMNS} from public.cases where organization_id = $1 order by created_at desc`,
        [organizationId],
      );
      return res.rows.map(toCase);
    },
  };
}
