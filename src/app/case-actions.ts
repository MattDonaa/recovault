"use server";

import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { assertRole } from "@/core/auth/authorization";
import { requireOrgAccess } from "@/core/auth/guards";
import { createCaseFromCandidate, transitionCase } from "@/core/cases/engine";
import { CASE_STATUSES, type CaseStatus } from "@/core/cases/status";
import { createInMemoryCaseStore } from "@/lib/cases/memory-store";

async function requireManage(organizationId: string) {
  const { user, membership } = await requireOrgAccess(organizationId);
  assertRole(membership, ["owner", "admin"]);
  return user;
}

/** Create a recovery case from an accepted candidate (idempotent). */
export async function createCaseAction(formData: FormData): Promise<void> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const candidateId = String(formData.get("candidateId") ?? "");
  const user = await requireManage(organizationId);

  const store = createInMemoryCaseStore();
  const candidate = await store.getCandidate(candidateId);
  if (!candidate || candidate.organizationId !== organizationId) notFound();

  const created = await createCaseFromCandidate(store, {
    candidateId,
    actorUserId: user.id,
    correlationId: randomUUID(),
  });
  redirect(`/app/org/${organizationId}/cases/${created.id}`);
}

/** Apply a validated case transition (records an audit event). */
export async function transitionCaseAction(formData: FormData): Promise<void> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const caseId = String(formData.get("caseId") ?? "");
  const to = String(formData.get("to") ?? "");
  const user = await requireManage(organizationId);

  if (!CASE_STATUSES.includes(to as CaseStatus)) throw new Error("Invalid target status");

  const store = createInMemoryCaseStore();
  const existing = await store.getCase(caseId);
  if (!existing || existing.organizationId !== organizationId) notFound();

  await transitionCase(store, {
    caseId,
    to: to as CaseStatus,
    actorUserId: user.id,
    correlationId: randomUUID(),
  });
  revalidatePath(`/app/org/${organizationId}/cases/${caseId}`);
  revalidatePath(`/app/org/${organizationId}/cases`);
}
