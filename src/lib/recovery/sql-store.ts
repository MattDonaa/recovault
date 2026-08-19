import type { EventType } from "@/core/ledger/types";
import type {
  DetectedCandidate,
  LedgerEvent,
  RecoveryContext,
  RecoveryStore,
} from "@/core/recovery/types";
import type { SqlExec } from "@/lib/ingestion/sql-store";

interface EventRow {
  id: string;
  event_type: EventType;
  external_ref: string;
  sku: string | null;
  order_external_id: string | null;
  references_json: Record<string, unknown>;
  quantity: number | null;
  amount_minor: string | number | null;
  currency: string | null;
  occurred_at: string | null;
  event_key: string;
  source_record_id: string;
}

/**
 * SQL-backed recovery store. Candidate insertion is idempotent
 * (`ON CONFLICT (marketplace_account_id, candidate_key) DO NOTHING`), so
 * re-running the engine never duplicates candidates. Evidence rows link each
 * candidate to the ledger events that justify it.
 */
export function createSqlRecoveryStore(exec: SqlExec): RecoveryStore {
  return {
    async listEvents(accountId: string): Promise<LedgerEvent[]> {
      const res = await exec.query<EventRow>(
        `select id, event_type, external_ref, sku, order_external_id,
                references_json, quantity, amount_minor, currency, occurred_at,
                event_key, source_record_id
         from public.marketplace_events
         where marketplace_account_id = $1
         order by event_key`,
        [accountId],
      );
      return res.rows.map((r) => ({
        id: r.id,
        eventType: r.event_type,
        externalRef: r.external_ref,
        sku: r.sku,
        orderExternalId: r.order_external_id,
        references: r.references_json ?? {},
        quantity: r.quantity,
        amountMinor: r.amount_minor === null ? null : Number(r.amount_minor),
        currency: r.currency,
        occurredAt: r.occurred_at === null ? null : String(r.occurred_at),
        eventKey: r.event_key,
        sourceRecordId: r.source_record_id,
      }));
    },

    async upsertCandidate({
      context,
      candidate,
    }: {
      context: RecoveryContext;
      candidate: DetectedCandidate;
    }): Promise<{ id: string | null; result: "inserted" | "unchanged" }> {
      const res = await exec.query<{ id: string }>(
        `insert into public.recovery_candidates (
           organization_id, marketplace_account_id, rule_id, rule_version,
           confidence, confidence_score, potential_recovery_minor, currency,
           sku, external_ref, title, summary, calculation, candidate_key
         ) values (
           $1, $2, $3, $4, $5::public.recovery_confidence, $6, $7, $8, $9, $10,
           $11, $12, $13::jsonb, $14
         )
         on conflict (marketplace_account_id, candidate_key) do nothing
         returning id`,
        [
          context.organizationId,
          context.marketplaceAccountId,
          candidate.ruleId,
          candidate.ruleVersion,
          candidate.confidence,
          candidate.confidenceScore,
          candidate.potentialRecoveryMinor,
          candidate.currency,
          candidate.sku,
          candidate.externalRef,
          candidate.title,
          candidate.summary,
          JSON.stringify(candidate.calculation ?? {}),
          candidate.candidateKey,
        ],
      );
      return res.rows.length > 0
        ? { id: res.rows[0]!.id, result: "inserted" }
        : { id: null, result: "unchanged" };
    },

    async linkEvidence({
      organizationId,
      candidateId,
      eventId,
      role,
    }: {
      organizationId: string;
      candidateId: string;
      eventId: string;
      role: string;
    }): Promise<void> {
      await exec.query(
        `insert into public.recovery_candidate_evidence (
           organization_id, recovery_candidate_id, marketplace_event_id, role
         ) values ($1, $2, $3, $4)
         on conflict (recovery_candidate_id, marketplace_event_id, role) do nothing`,
        [organizationId, candidateId, eventId, role],
      );
    },

    async deleteCandidates(accountId: string): Promise<void> {
      await exec.query(
        `delete from public.recovery_candidates where marketplace_account_id = $1`,
        [accountId],
      );
    },
  };
}
