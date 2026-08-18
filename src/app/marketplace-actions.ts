"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { assertRole } from "@/core/auth/authorization";
import { requireOrgAccess } from "@/core/auth/guards";
import { verifyConnection } from "@/core/marketplace/verification";
import { decryptSecret } from "@/core/security/crypto";
import { MockMarketplaceAdapter } from "@/integrations/mock/adapter";
import { getScenario } from "@/integrations/mock/fixtures";
import { TakealotMarketplaceAdapter } from "@/integrations/takealot/adapter";
import {
  createLiveConnection,
  createMockConnection,
  getConnection,
  getCredentialCiphertext,
  markConnectionPending,
  setVerification,
  storeCredential,
} from "@/lib/marketplace/mock-accounts";

export interface MarketplaceFormState {
  error?: string;
}

async function requireManage(organizationId: string) {
  const { membership } = await requireOrgAccess(organizationId);
  assertRole(membership, ["owner", "admin"]);
}

export async function connectMockMarketplaceAction(
  _prev: MarketplaceFormState,
  formData: FormData,
): Promise<MarketplaceFormState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const scenarioKey = String(formData.get("scenarioKey") ?? "");
  try {
    await requireManage(organizationId);
  } catch {
    return { error: "You do not have permission to connect a marketplace." };
  }
  if (!getScenario(scenarioKey)) {
    return { error: "Please choose a valid demo scenario." };
  }
  const connection = createMockConnection(organizationId, scenarioKey);
  redirect(`/app/org/${organizationId}/marketplace/${connection.id}`);
}

export async function connectLiveTakealotAction(
  _prev: MarketplaceFormState,
  formData: FormData,
): Promise<MarketplaceFormState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim() || "Takealot (LIVE)";
  const apiKey = String(formData.get("apiKey") ?? "");

  try {
    await requireManage(organizationId);
  } catch {
    return { error: "You do not have permission to connect a marketplace." };
  }
  if (apiKey.trim().length < 8) {
    return { error: "Enter a valid API key." };
  }

  // Create the connection, then encrypt+store the key. Storing does NOT verify:
  // the connection stays unverified until a real verification succeeds.
  const connection = createLiveConnection(organizationId, "takealot", displayName);
  storeCredential(organizationId, connection.id, apiKey);
  redirect(`/app/org/${organizationId}/marketplace/${connection.id}`);
}

export async function rotateCredentialAction(
  _prev: MarketplaceFormState,
  formData: FormData,
): Promise<MarketplaceFormState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const connectionId = String(formData.get("connectionId") ?? "");
  const apiKey = String(formData.get("apiKey") ?? "");

  try {
    await requireManage(organizationId);
  } catch {
    return { error: "You do not have permission to update this connection." };
  }
  const connection = getConnection(organizationId, connectionId);
  if (!connection) return { error: "Connection not found." };
  if (apiKey.trim().length < 8) {
    return { error: "Enter a valid API key." };
  }

  storeCredential(organizationId, connectionId, apiKey);
  markConnectionPending(organizationId, connectionId);
  revalidatePath(`/app/org/${organizationId}/marketplace/${connectionId}`);
  return {};
}

/**
 * Verify a connection. Reaches "connected" ONLY when a real adapter
 * verifyConnection() returns ok. Mock verifies without a credential; live
 * requires the stored (decrypted) credential.
 */
export async function verifyConnectionAction(formData: FormData): Promise<void> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const connectionId = String(formData.get("connectionId") ?? "");
  await requireManage(organizationId);

  const connection = getConnection(organizationId, connectionId);
  if (!connection) return;

  const result = await verifyConnection(
    { mode: connection.mode, scenarioKey: connection.scenarioKey },
    {
      buildMockAdapter: (key) => {
        const scenario = getScenario(key);
        return scenario ? new MockMarketplaceAdapter(scenario) : null;
      },
      buildLiveAdapter: (apiKey) => new TakealotMarketplaceAdapter({ apiKey }),
      getCiphertext: () => getCredentialCiphertext(organizationId, connectionId),
      decrypt: (ciphertext) => decryptSecret(ciphertext),
    },
  );

  setVerification(organizationId, connectionId, result);
  revalidatePath(`/app/org/${organizationId}/marketplace/${connectionId}`);
}
