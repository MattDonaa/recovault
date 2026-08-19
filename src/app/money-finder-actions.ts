"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { assertRole } from "@/core/auth/authorization";
import { requireOrgAccess } from "@/core/auth/guards";
import {
  CANDIDATE_STATUSES,
  type CandidateStatus,
} from "@/core/recovery/workflow";
import {
  analyzeConnection,
  transitionCandidate,
} from "@/lib/marketplace/money-finder-store";

async function requireManage(organizationId: string) {
  const { membership } = await requireOrgAccess(organizationId);
  assertRole(membership, ["owner", "admin"]);
}

/** Run the deterministic analysis for a mock connection and open Money Finder. */
export async function runAnalysisAction(formData: FormData): Promise<void> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const connectionId = String(formData.get("connectionId") ?? "");
  await requireManage(organizationId);
  await analyzeConnection(organizationId, connectionId);
  redirect(`/app/org/${organizationId}/money-finder`);
}

/** Apply a workflow transition. Invalid transitions are rejected server-side. */
export async function transitionCandidateAction(formData: FormData): Promise<void> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const candidateId = String(formData.get("candidateId") ?? "");
  const to = String(formData.get("to") ?? "");
  await requireManage(organizationId);

  if (!CANDIDATE_STATUSES.includes(to as CandidateStatus)) {
    throw new Error("Invalid target status");
  }
  transitionCandidate(organizationId, candidateId, to as CandidateStatus);
  revalidatePath(`/app/org/${organizationId}/money-finder/${candidateId}`);
  revalidatePath(`/app/org/${organizationId}/money-finder`);
}
