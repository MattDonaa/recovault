import { randomUUID } from "node:crypto";

import { encryptSecret } from "@/core/security/crypto";
import type { MarketplaceAccountStatus, MarketplaceMode } from "@/core/tenancy/schema";
import { getScenario } from "@/integrations/mock/fixtures";

/**
 * In-memory marketplace-connection store for MOCK-FIRST / offline / test mode.
 * Credentials are held ONLY as ciphertext (AES-256-GCM); plaintext is never
 * stored and never exposed to callers. The UI-facing shape omits the secret
 * entirely and exposes `hasCredential` instead. The real DB-backed equivalent
 * (with RLS) is defined in supabase/migrations/0003_marketplace_credentials.sql
 * and exercised by the PGlite integration tests.
 */
export interface MarketplaceConnection {
  id: string;
  organizationId: string;
  marketplace: string;
  mode: MarketplaceMode;
  displayName: string;
  scenarioKey: string | null;
  status: MarketplaceAccountStatus;
  verifiedAt: string | null;
  lastVerificationError: string | null;
  hasCredential: boolean;
  createdAt: string;
}

interface StoredConnection extends MarketplaceConnection {
  /** Encrypted credential envelope. Never returned to callers. */
  encryptedSecret: string | null;
}

interface AuditEvent {
  organizationId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
}

interface Store {
  connections: StoredConnection[];
  audit: AuditEvent[];
}

const GLOBAL_KEY = "__recovault_connections__";

function store(): Store {
  const g = globalThis as unknown as Record<string, Store | undefined>;
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = { connections: [], audit: [] };
  return g[GLOBAL_KEY]!;
}

export function resetConnections(): void {
  const s = store();
  s.connections.length = 0;
  s.audit.length = 0;
}

export function mockAuditEvents(): ReadonlyArray<AuditEvent> {
  return store().audit;
}

/** Strip the secret before returning any connection to a caller. */
function toPublic(c: StoredConnection): MarketplaceConnection {
  const { encryptedSecret: _secret, ...rest } = c;
  void _secret;
  return { ...rest, hasCredential: c.encryptedSecret !== null };
}

function find(
  organizationId: string,
  id: string,
): StoredConnection | undefined {
  return store().connections.find(
    (c) => c.organizationId === organizationId && c.id === id,
  );
}

/** Create a MOCK demo connection pinned to a fixture scenario. */
export function createMockConnection(
  organizationId: string,
  scenarioKey: string,
): MarketplaceConnection {
  const scenario = getScenario(scenarioKey);
  if (!scenario) throw new Error(`Unknown scenario: ${scenarioKey}`);
  const conn: StoredConnection = {
    id: randomUUID(),
    organizationId,
    marketplace: "mock",
    mode: "mock",
    displayName: `${scenario.manifest.label} (MOCK)`,
    scenarioKey,
    status: "pending",
    verifiedAt: null,
    lastVerificationError: null,
    hasCredential: false,
    encryptedSecret: null,
    createdAt: new Date().toISOString(),
  };
  store().connections.push(conn);
  store().audit.push({
    organizationId,
    action: "marketplace.connection_created",
    entityType: "marketplace_account",
    entityId: conn.id,
    createdAt: conn.createdAt,
  });
  return toPublic(conn);
}

/** Create a LIVE connection (e.g. Takealot). Starts unverified/pending. */
export function createLiveConnection(
  organizationId: string,
  marketplace: string,
  displayName: string,
): MarketplaceConnection {
  const conn: StoredConnection = {
    id: randomUUID(),
    organizationId,
    marketplace,
    mode: "live",
    displayName,
    scenarioKey: null,
    status: "pending",
    verifiedAt: null,
    lastVerificationError: null,
    hasCredential: false,
    encryptedSecret: null,
    createdAt: new Date().toISOString(),
  };
  store().connections.push(conn);
  store().audit.push({
    organizationId,
    action: "marketplace.connection_created",
    entityType: "marketplace_account",
    entityId: conn.id,
    createdAt: conn.createdAt,
  });
  return toPublic(conn);
}

/**
 * Store (or rotate) a credential for a connection. The plaintext is encrypted
 * immediately and never retained. Storing a credential does NOT verify it — the
 * status stays as-is until an actual verification runs. The audit record never
 * contains the secret.
 */
export function storeCredential(
  organizationId: string,
  connectionId: string,
  plaintext: string,
): void {
  const conn = find(organizationId, connectionId);
  if (!conn) throw new Error("Connection not found");
  conn.encryptedSecret = encryptSecret(plaintext);
  conn.hasCredential = true;
  store().audit.push({
    organizationId,
    action: "marketplace.credential_stored",
    entityType: "marketplace_account",
    entityId: conn.id,
    createdAt: new Date().toISOString(),
  });
}

/** Server-only: read the encrypted credential envelope for verification. */
export function getCredentialCiphertext(
  organizationId: string,
  connectionId: string,
): string | null {
  return find(organizationId, connectionId)?.encryptedSecret ?? null;
}

/** Record the outcome of a verification attempt. */
export function setVerification(
  organizationId: string,
  connectionId: string,
  result: { ok: boolean; message: string | null },
): void {
  const conn = find(organizationId, connectionId);
  if (!conn) throw new Error("Connection not found");
  if (result.ok) {
    conn.status = "connected";
    conn.verifiedAt = new Date().toISOString();
    conn.lastVerificationError = null;
  } else {
    conn.status = "error";
    conn.lastVerificationError = result.message;
  }
}

/** Reset a connection to unverified/pending (e.g. after credential rotation). */
export function markConnectionPending(
  organizationId: string,
  connectionId: string,
): void {
  const conn = find(organizationId, connectionId);
  if (!conn) throw new Error("Connection not found");
  conn.status = "pending";
  conn.verifiedAt = null;
  conn.lastVerificationError = null;
}

export function listConnections(
  organizationId: string,
): MarketplaceConnection[] {
  return store()
    .connections.filter((c) => c.organizationId === organizationId)
    .map(toPublic);
}

export function getConnection(
  organizationId: string,
  connectionId: string,
): MarketplaceConnection | null {
  const conn = find(organizationId, connectionId);
  return conn ? toPublic(conn) : null;
}
