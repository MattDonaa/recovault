import type {
  RecoveryMatchStore,
  RecoveryRecordInput,
} from "@/core/recovery/match-engine";
import type { OpenCaseRef } from "@/core/recovery/matching";
import type { LedgerEvent } from "@/core/recovery/types";
import type { CaseStatus } from "@/core/cases/status";
import { createSqlRecoveryStore } from "@/lib/recovery/sql-store";
import type { SqlExec } from "@/lib/ingestion/sql-store";

/** SQL-backed recovery-matching store (DB path; PGlite-verified). */
export function createSqlRecoveryMatchStore(exec: SqlExec): RecoveryMatchStore {
  const ledger = createSqlRecoveryStore(exec);

  return {
    listEvents(accountId: string): Promise<LedgerEvent[]> {
      return ledger.listEvents(accountId);
    },

    async listOpenCases(accountId: string): Promise<OpenCaseRef[]> {
      const res = await exec.query<{ id: string; loss_ref: string | null; status: CaseStatus }>(
        `select c.id, rc.external_ref as loss_ref, c.status
         from public.cases c
         join public.recovery_candidates rc on rc.id = c.recovery_candidate_id
         where c.marketplace_account_id = $1
           and c.status not in ('recovered', 'closed')`,
        [accountId],
      );
      return res.rows
        .filter((r) => r.loss_ref !== null)
        .map((r) => ({ caseId: r.id, lossRef: r.loss_ref as string, status: r.status }));
    },

    async upsertRecoveryRecord(input: RecoveryRecordInput): Promise<"inserted" | "unchanged"> {
      const res = await exec.query<{ id: string }>(
        `insert into public.recovery_records (
           organization_id, marketplace_account_id, marketplace_event_id, case_id,
           status, amount_minor, currency, external_ref, reason, matched_at
         ) values (
           $1, $2, $3, $4, $5::public.recovery_record_status, $6, $7, $8, $9, $10::timestamptz
         )
         on conflict (marketplace_account_id, marketplace_event_id) do nothing
         returning id`,
        [
          input.organizationId,
          input.marketplaceAccountId,
          input.marketplaceEventId,
          input.caseId,
          input.status,
          input.amountMinor,
          input.currency,
          input.externalRef,
          input.reason,
          input.matchedAt,
        ],
      );
      return res.rows.length > 0 ? "inserted" : "unchanged";
    },

    async markCaseRecovered(
      caseId: string,
      actorUserId: string | null,
    ): Promise<"recovered" | "skipped"> {
      const res = await exec.query<{ organization_id: string; status: CaseStatus }>(
        `select organization_id, status from public.cases where id = $1`,
        [caseId],
      );
      const row = res.rows[0];
      if (!row || row.status !== "payment_expected") return "skipped";

      await exec.query(
        `update public.cases set status = 'recovered' where id = $1`,
        [caseId],
      );
      await exec.query(
        `insert into public.case_events (
           organization_id, case_id, actor_user_id, event_type, from_status,
           to_status, reason, metadata, correlation_id
         ) values ($1, $2, $3, 'transition', 'payment_expected', 'recovered',
                   'Recovery matched and verified', '{}'::jsonb, null)`,
        [row.organization_id, caseId, actorUserId],
      );
      return "recovered";
    },
  };
}
