"use server";

import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { assertRole } from "@/core/auth/authorization";
import { requireOrgAccess } from "@/core/auth/guards";
import { createCaseFromCandidate, transitionCase } from "@/core/cases/engine";
import { CASE_STATUSES, type CaseStatus } from "@/core/cases/status";
import { submitCase } from "@/core/claims/submit";
import { runRecoveryMatching } from "@/core/recovery/match-engine";
import { createInMemoryCaseStore, getCaseById } from "@/lib/cases/memory-store";
import { findStoredCandidate } from "@/lib/marketplace/money-finder-store";
import {
  createInMemoryMatchStore,
  ingestDemoRecovery,
} from "@/lib/recovery/memory-recovery";

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

/**
 * Mark a case as submitted to the marketplace (manual). Requires an external
 * reference and a submission date; records a submitted audit event and sets the
 * separate deadline clocks. Nothing is sent to the marketplace on the seller's
 * behalf — this only records the seller's own manual submission.
 */
export async function submitClaimAction(formData: FormData): Promise<void> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const caseId = String(formData.get("caseId") ?? "");
  const externalReference = String(formData.get("externalReference") ?? "");
  const submittedAt = String(formData.get("submittedAt") ?? "");
  const user = await requireManage(organizationId);

  const store = createInMemoryCaseStore();
  const existing = await store.getCase(caseId);
  if (!existing || existing.organizationId !== organizationId) notFound();

  await submitCase(store, {
    caseId,
    externalReference,
    submittedAt,
    actorUserId: user.id,
    correlationId: randomUUID(),
  });
  revalidatePath(`/app/org/${organizationId}/cases/${caseId}`);
}

/**
 * DEMO: ingest a synthetic matching recovery/payment for this case's loss
 * reference and run deterministic matching. A valid match on a case awaiting
 * payment closes it as recovered. This simulates a later marketplace sync in
 * mock mode — real recoveries arrive via an actual sync.
 */
export async function recordRecoveryAction(formData: FormData): Promise<void> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const caseId = String(formData.get("caseId") ?? "");
  const user = await requireManage(organizationId);

  const record = getCaseById(caseId);
  if (!record || record.organizationId !== organizationId) notFound();

  const candidate = findStoredCandidate(record.recoveryCandidateId);
  const lossRef = candidate?.externalRef ?? record.externalReference ?? record.id;
  ingestDemoRecovery(
    record.marketplaceAccountId,
    lossRef,
    record.potentialRecoveryMinor,
    record.currency ?? "ZAR",
  );

  await runRecoveryMatching(createInMemoryMatchStore(), {
    organizationId,
    marketplaceAccountId: record.marketplaceAccountId,
    actorUserId: user.id,
  });

  revalidatePath(`/app/org/${organizationId}/cases/${caseId}`);
  revalidatePath(`/app/org/${organizationId}/money-finder`);
}
