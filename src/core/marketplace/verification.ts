import type { MarketplaceAdapter } from "@/core/marketplace/adapter";

/**
 * Connection verification. A connection reaches "verified" ONLY through a real
 * adapter `verifyConnection()` returning ok — it is never faked. Mock
 * connections verify without any credential; live connections require a stored
 * credential and are verified against the real adapter using the decrypted key.
 */
export interface VerifiableConnection {
  mode: "mock" | "live";
  scenarioKey: string | null;
}

export interface VerificationDeps {
  /** Build a mock adapter for a scenario, or null if the scenario is unknown. */
  buildMockAdapter: (scenarioKey: string) => MarketplaceAdapter | null;
  /** Build the live adapter from a decrypted API key. */
  buildLiveAdapter: (apiKey: string) => MarketplaceAdapter;
  /** Return the encrypted credential envelope, or null if none is stored. */
  getCiphertext: () => string | null;
  /** Decrypt an envelope to the plaintext key (server-only). */
  decrypt: (ciphertext: string) => string;
}

export interface VerificationResult {
  ok: boolean;
  message: string | null;
}

export async function verifyConnection(
  connection: VerifiableConnection,
  deps: VerificationDeps,
): Promise<VerificationResult> {
  if (connection.mode === "mock") {
    if (!connection.scenarioKey) {
      return { ok: false, message: "Mock connection has no scenario" };
    }
    const adapter = deps.buildMockAdapter(connection.scenarioKey);
    if (!adapter) return { ok: false, message: "Unknown mock scenario" };
    const status = await adapter.verifyConnection();
    return { ok: status.ok, message: status.message };
  }

  // Live: a credential is mandatory. Without one, it can never be verified.
  const ciphertext = deps.getCiphertext();
  if (!ciphertext) {
    return { ok: false, message: "No credential provided" };
  }
  let apiKey: string;
  try {
    apiKey = deps.decrypt(ciphertext);
  } catch {
    return { ok: false, message: "Stored credential could not be read" };
  }
  const adapter = deps.buildLiveAdapter(apiKey);
  const status = await adapter.verifyConnection();
  return { ok: status.ok, message: status.message };
}
