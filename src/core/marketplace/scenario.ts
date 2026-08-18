import { z } from "zod";

/**
 * Scenario fixtures + human-readable manifests. Each fixture declares the raw
 * (pre-validation) records the mock marketplace will serve, and a manifest
 * stating the expected validated record counts and the expected recovery-rule
 * outcomes. Detector expectations are DECLARED here (fixture rule) but not
 * executed — the recovery rules are implemented in a later milestone.
 */

export const RULE_IDS = ["MR-001", "MR-002", "MR-003"] as const;
export const ruleIdSchema = z.enum(RULE_IDS);
export type RuleId = z.infer<typeof ruleIdSchema>;

export const DETECTOR_OUTCOMES = [
  "candidate",
  "no_candidate",
  "needs_review",
] as const;
export const detectorOutcomeSchema = z.enum(DETECTOR_OUTCOMES);
export type DetectorOutcome = z.infer<typeof detectorOutcomeSchema>;

export const detectorExpectationSchema = z.object({
  rule: ruleIdSchema,
  outcome: detectorOutcomeSchema,
  note: z.string().min(1),
});
export type DetectorExpectation = z.infer<typeof detectorExpectationSchema>;

export const expectedCountsSchema = z.object({
  offers: z.number().int().min(0),
  sales: z.number().int().min(0),
  returns: z.number().int().min(0),
  shipments: z.number().int().min(0),
  transactions: z.number().int().min(0),
  balances: z.number().int().min(0),
  quarantined: z.number().int().min(0),
});
export type ExpectedCounts = z.infer<typeof expectedCountsSchema>;

export const scenarioManifestSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9-]{1,60}$/),
  label: z.string().min(1),
  description: z.string().min(1),
  expected: expectedCountsSchema,
  detectorExpectations: z.array(detectorExpectationSchema),
});
export type ScenarioManifest = z.infer<typeof scenarioManifestSchema>;

export interface RawScenarioData {
  seller: unknown;
  offers: unknown[];
  sales: unknown[];
  returns: unknown[];
  shipments: unknown[];
  transactions: unknown[];
  balances: unknown[];
}

export interface ScenarioFixture {
  manifest: ScenarioManifest;
  data: RawScenarioData;
}

export function validateManifest(manifest: unknown): ScenarioManifest {
  return scenarioManifestSchema.parse(manifest);
}
