import { randomUUID } from "node:crypto";

import { getScenario } from "@/integrations/mock/fixtures";

/**
 * In-memory registry of MOCK/demo marketplace accounts (metadata only — never
 * credentials). Persisting source records to the database is a later milestone;
 * here a demo account simply pins an organization to a fixture scenario so the
 * adapter can be exercised through the UI. Persisted on globalThis to survive
 * Next dev reloads within one server process.
 */
export interface MockMarketplaceAccount {
  id: string;
  organizationId: string;
  scenarioKey: string;
  displayName: string;
  marketplace: "mock";
  mode: "mock";
  status: "connected";
  createdAt: string;
}

const GLOBAL_KEY = "__recovault_mock_accounts__";

function accounts(): MockMarketplaceAccount[] {
  const g = globalThis as unknown as Record<
    string,
    MockMarketplaceAccount[] | undefined
  >;
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = [];
  return g[GLOBAL_KEY]!;
}

export function resetMockAccounts(): void {
  accounts().length = 0;
}

export function createMockAccount(
  organizationId: string,
  scenarioKey: string,
): MockMarketplaceAccount {
  const scenario = getScenario(scenarioKey);
  if (!scenario) throw new Error(`Unknown scenario: ${scenarioKey}`);
  const account: MockMarketplaceAccount = {
    id: randomUUID(),
    organizationId,
    scenarioKey,
    displayName: `${scenario.manifest.label} (MOCK)`,
    marketplace: "mock",
    mode: "mock",
    status: "connected",
    createdAt: new Date().toISOString(),
  };
  accounts().push(account);
  return account;
}

export function listMockAccounts(
  organizationId: string,
): MockMarketplaceAccount[] {
  return accounts().filter((a) => a.organizationId === organizationId);
}

export function getMockAccount(
  organizationId: string,
  accountId: string,
): MockMarketplaceAccount | null {
  return (
    accounts().find(
      (a) => a.organizationId === organizationId && a.id === accountId,
    ) ?? null
  );
}
