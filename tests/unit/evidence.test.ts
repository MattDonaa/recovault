import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildEvidencePack,
  EVIDENCE_DISCLAIMER,
  quantitiesFromCalculation,
  type EvidencePackInput,
} from "@/core/evidence/pack";
import { renderEvidencePdf } from "@/lib/evidence/pdf";

const input: EvidencePackInput = {
  caseId: "case-1",
  marketplace: "mock",
  marketplaceAccountId: "acc-1",
  ruleId: "MR-001",
  ruleVersion: "MR-001:v1",
  confidence: "HIGH",
  title: "Unaccounted inbound units (6)",
  summary: "Inbound shipment shows 6 unaccounted units.",
  sku: "SKU-A",
  orderExternalId: null,
  externalRef: "shp-1",
  quantities: { quantitySent: 50, quantityReceived: 44, quantityDamaged: 0, unaccounted: 6 },
  calculation: { quantitySent: 50, quantityReceived: 44, quantityDamaged: 0, unaccounted: 6, formula: "sent - received - damaged" },
  amountMinor: 19900,
  currency: "ZAR",
  timeline: [{ at: "2026-01-01T00:00:00.000Z", label: "created: draft" }],
  sourceEvidence: [{ role: "shipment", eventKey: "shipment_item:shp-1", sourceRecordId: "shipments:0" }],
  claim: null,
};

describe("evidence pack", () => {
  it("returns exactly the persisted values plus generated-at + disclaimer", () => {
    const pack = buildEvidencePack(input, { now: "2026-02-01T00:00:00.000Z" });
    expect(pack.generatedAt).toBe("2026-02-01T00:00:00.000Z");
    expect(pack.disclaimer).toBe(EVIDENCE_DISCLAIMER);
    // Every input field is preserved exactly (no fabrication, exact money).
    expect(pack.amountMinor).toBe(19900);
    expect(pack.calculation).toEqual(input.calculation);
    expect(pack.quantities).toEqual(input.quantities);
    expect(pack.sourceEvidence).toEqual(input.sourceEvidence);
    expect(pack.ruleVersion).toBe("MR-001:v1");
  });

  it("derives quantities from integer calculation fields", () => {
    expect(quantitiesFromCalculation({ a: 5, b: 2.5, c: "x", d: 0 })).toEqual({ a: 5, d: 0 });
  });

  it("generates a valid PDF (smoke test)", async () => {
    const pack = buildEvidencePack(input, { now: "2026-02-01T00:00:00.000Z" });
    const bytes = await renderEvidencePdf(pack);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1000);
  });
});

describe("evidence language guardrail", () => {
  const FORBIDDEN = ["owes you", "guaranteed recovery", "guaranteed claim", "guaranteed money", "confirmed debt", "marketplace owes"];

  it("disclaimer uses no unsupported claim language", () => {
    const text = EVIDENCE_DISCLAIMER.toLowerCase();
    for (const phrase of FORBIDDEN) expect(text).not.toContain(phrase);
    expect(text).toContain("not a guarantee");
  });

  it("evidence and claim code contain no forbidden liability language", () => {
    const dirs = [
      path.resolve(process.cwd(), "src", "core", "evidence"),
      path.resolve(process.cwd(), "src", "core", "claims"),
      path.resolve(process.cwd(), "src", "lib", "evidence"),
    ];
    const offenders: string[] = [];
    for (const dir of dirs) {
      for (const file of walk(dir)) {
        const text = readFileSync(file, "utf8").toLowerCase();
        for (const phrase of FORBIDDEN) if (text.includes(phrase)) offenders.push(`${file}: ${phrase}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("no automatic claim submission (AC-05)", () => {
  it("contains no auto-submission / browser-automation implementation in src", () => {
    const FORBIDDEN = [/puppeteer/i, /auto[-_ ]?submit/i, /submitclaimtomarketplace/i, /seller[-_ ]?portal.*(automat|login)/i];
    const offenders: string[] = [];
    for (const file of walk(path.resolve(process.cwd(), "src"))) {
      const text = readFileSync(file, "utf8");
      for (const re of FORBIDDEN) if (re.test(text)) offenders.push(`${file}: ${re}`);
    }
    expect(offenders).toEqual([]);
  });
});

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full);
  }
  return out;
}
