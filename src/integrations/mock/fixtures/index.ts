import type { ScenarioFixture } from "@/core/marketplace/scenario";

import { SCENARIOS } from "@/integrations/mock/fixtures/scenarios";

const BY_KEY: ReadonlyMap<string, ScenarioFixture> = new Map(
  SCENARIOS.map((s) => [s.manifest.key, s]),
);

export function listScenarios(): readonly ScenarioFixture[] {
  return SCENARIOS;
}

export function listScenarioSummaries(): { key: string; label: string; description: string }[] {
  return SCENARIOS.map((s) => ({
    key: s.manifest.key,
    label: s.manifest.label,
    description: s.manifest.description,
  }));
}

export function getScenario(key: string): ScenarioFixture | undefined {
  return BY_KEY.get(key);
}

export const DEFAULT_SCENARIO_KEY = "healthy";

export { SCENARIOS };
