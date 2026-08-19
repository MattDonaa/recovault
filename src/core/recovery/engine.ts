import { RECOVERY_RULES } from "@/core/recovery/registry";
import type {
  RecoveryContext,
  RecoveryResult,
  RecoveryStore,
} from "@/core/recovery/types";

/**
 * Run every versioned rule over the account's canonical ledger and persist the
 * resulting candidates. Insertion is idempotent (keyed on the deterministic
 * candidate key), so re-running produces no duplicates. Evidence links are
 * written for newly inserted candidates so each candidate is explainable from
 * source → ledger → rule → calculation.
 */
export async function runRecovery(
  store: RecoveryStore,
  ctx: RecoveryContext,
): Promise<RecoveryResult> {
  const events = await store.listEvents(ctx.marketplaceAccountId);
  const result: RecoveryResult = {
    candidatesDetected: 0,
    candidatesInserted: 0,
    candidatesUnchanged: 0,
  };

  for (const rule of RECOVERY_RULES) {
    for (const candidate of rule.evaluate(events)) {
      result.candidatesDetected += 1;
      const { id, result: outcome } = await store.upsertCandidate({
        context: ctx,
        candidate,
      });
      if (outcome === "inserted" && id) {
        result.candidatesInserted += 1;
        for (const ev of candidate.evidence) {
          await store.linkEvidence({
            organizationId: ctx.organizationId,
            candidateId: id,
            eventId: ev.eventId,
            role: ev.role,
          });
        }
      } else {
        result.candidatesUnchanged += 1;
      }
    }
  }

  return result;
}

/** Rebuild candidates from the ledger (dev/test): delete then re-run. */
export async function rebuildRecovery(
  store: RecoveryStore,
  ctx: RecoveryContext,
): Promise<RecoveryResult> {
  await store.deleteCandidates(ctx.marketplaceAccountId);
  return runRecovery(store, ctx);
}
