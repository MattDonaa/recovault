import { normalizeSourceRecord } from "@/core/ledger/normalize";
import type { SourceRecordRow } from "@/core/ledger/types";
import { collectAll } from "@/core/marketplace/pagination";
import { RECOVERY_RULES } from "@/core/recovery/registry";
import type { DetectedCandidate, LedgerEvent } from "@/core/recovery/types";
import { MockMarketplaceAdapter } from "@/integrations/mock/adapter";
import { getScenario } from "@/integrations/mock/fixtures";

/**
 * MOCK-mode analysis. Runs the SAME deterministic core the database path uses —
 * MockMarketplaceAdapter → normalize → recovery rules — entirely in memory, so
 * the running app produces identical candidates to the PGlite-verified pipeline
 * without a database. Money stays exact integer minor units throughout.
 */
export interface AnalysisResult {
  events: LedgerEvent[];
  candidates: DetectedCandidate[];
}

function externalIdOf(record: unknown): string {
  const r = record as { externalId?: unknown; currency?: unknown };
  if (typeof r.externalId === "string") return r.externalId;
  if (typeof r.currency === "string") return r.currency;
  return "unknown";
}

export async function analyzeScenario(scenarioKey: string): Promise<AnalysisResult> {
  const scenario = getScenario(scenarioKey);
  if (!scenario) throw new Error(`Unknown scenario: ${scenarioKey}`);
  const adapter = new MockMarketplaceAdapter(scenario);

  const rows: SourceRecordRow[] = [];
  const add = (externalType: string, records: readonly unknown[]) => {
    records.forEach((rec, i) => {
      rows.push({
        id: `${externalType}:${i}`,
        organizationId: "",
        marketplaceAccountId: "",
        marketplace: adapter.marketplace,
        externalType,
        externalId: externalIdOf(rec),
        sourceTimestamp: null,
        payload: rec,
      });
    });
  };

  add("offers", (await collectAll((c) => adapter.listOffers({ cursor: c }))).records);
  add("sales", (await collectAll((c) => adapter.listSales({ cursor: c }))).records);
  add("returns", (await collectAll((c) => adapter.listReturns({ cursor: c }))).records);
  add("shipments", (await collectAll((c) => adapter.listShipments({ cursor: c }))).records);
  add("transactions", (await collectAll((c) => adapter.listTransactions({ cursor: c }))).records);
  add("balances", await adapter.listBalances());

  const events: LedgerEvent[] = [];
  for (const row of rows) {
    for (const ev of normalizeSourceRecord(row)) {
      events.push({
        id: `evt:${ev.eventKey}`,
        eventType: ev.eventType,
        externalRef: ev.externalRef,
        sku: ev.sku,
        orderExternalId: ev.orderExternalId,
        references: ev.references,
        quantity: ev.quantity,
        amountMinor: ev.amountMinor,
        currency: ev.currency,
        occurredAt: ev.occurredAt,
        eventKey: ev.eventKey,
        sourceRecordId: row.id,
      });
    }
  }

  const candidates = RECOVERY_RULES.flatMap((rule) => rule.evaluate(events));
  return { events, candidates };
}
