"use server";

import { redirect } from "next/navigation";

import { assertRole } from "@/core/auth/authorization";
import { requireOrgAccess } from "@/core/auth/guards";
import { getScenario } from "@/integrations/mock/fixtures";
import { createMockAccount } from "@/lib/marketplace/mock-accounts";

export interface MarketplaceFormState {
  error?: string;
}

export async function connectMockMarketplaceAction(
  _prev: MarketplaceFormState,
  formData: FormData,
): Promise<MarketplaceFormState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const scenarioKey = String(formData.get("scenarioKey") ?? "");

  // Server-side authorization: must be an owner/admin of this org.
  const { membership } = await requireOrgAccess(organizationId);
  try {
    assertRole(membership, ["owner", "admin"]);
  } catch {
    return { error: "You do not have permission to connect a marketplace." };
  }

  if (!getScenario(scenarioKey)) {
    return { error: "Please choose a valid demo scenario." };
  }

  const account = createMockAccount(organizationId, scenarioKey);
  redirect(`/app/org/${organizationId}/marketplace/${account.id}`);
}
