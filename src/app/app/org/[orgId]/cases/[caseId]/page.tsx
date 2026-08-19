import Link from "next/link";
import { notFound } from "next/navigation";

import { recordRecoveryAction, submitClaimAction } from "@/app/case-actions";
import { CaseTransitionButtons } from "@/components/cases/case-transition-buttons";
import { MockBanner } from "@/components/marketplace/mock-banner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireOrgAccess } from "@/core/auth/guards";
import { countdown } from "@/core/claims/deadlines";
import { EVIDENCE_DISCLAIMER } from "@/core/evidence/pack";
import { formatMoneyMinor } from "@/core/money/format";
import { isMockMode } from "@/lib/auth";
import {
  getCaseById,
  listCaseEvents,
  listCaseEvidence,
} from "@/lib/cases/memory-store";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; caseId: string }>;
}) {
  const { orgId, caseId } = await params;
  await requireOrgAccess(orgId);

  const record = getCaseById(caseId);
  if (!record || record.organizationId !== orgId) notFound();
  const events = listCaseEvents(caseId);
  const evidence = listCaseEvidence(caseId);

  const now = new Date().toISOString();
  const submissionCountdown = countdown(record.submissionDeadlineAt, now);
  const slaCountdown = countdown(record.disputeSlaDeadlineAt, now);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href={`/app/org/${orgId}/cases`} className="text-sm text-muted-foreground underline">
          ← Back to cases
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-bold tracking-tight">{record.title}</h1>
          <span
            data-testid="case-status"
            className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase text-primary"
          >
            {record.status.replace(/_/g, " ")}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{record.summary}</p>
      </div>

      {isMockMode() ? <MockBanner /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Potential recovery</CardTitle>
            <CardDescription>Snapshot from the accepted candidate.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-bold tabular-nums text-primary">
              {formatMoneyMinor(record.potentialRecoveryMinor, record.currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              Rule {record.ruleId} · version {record.ruleVersion}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Advance case</CardTitle>
            <CardDescription>Transitions are validated and audited.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <CaseTransitionButtons organizationId={orgId} caseId={record.id} status={record.status} />
            {record.status === "payment_expected" ? (
              <form action={recordRecoveryAction}>
                <input type="hidden" name="organizationId" value={orgId} />
                <input type="hidden" name="caseId" value={record.id} />
                <Button type="submit" size="sm" variant="outline" data-testid="record-recovery">
                  Record incoming recovery (demo)
                </Button>
              </form>
            ) : null}
            {record.status === "recovered" ? (
              <p className="text-sm font-medium text-success" data-testid="recovered-note">
                Recovery verified and matched. This case is recovered.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Claim &amp; evidence</CardTitle>
          <CardDescription>
            Generate a deterministic evidence pack, then track your manual claim
            submission. RecoVault never submits claims automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <a
            href={`/app/org/${orgId}/cases/${record.id}/evidence`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm font-medium text-primary underline"
            data-testid="evidence-pdf-link"
          >
            Download evidence pack (PDF) →
          </a>

          {record.submittedAt ? (
            <div className="space-y-2 text-sm" data-testid="claim-details">
              <p>
                <span className="font-medium">Claim reference:</span>{" "}
                {record.externalReference}
              </p>
              <p>
                <span className="font-medium">Submitted:</span> {record.submittedAt}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div
                  className="rounded-md border px-3 py-2"
                  data-testid="submission-deadline"
                >
                  <p className="text-xs text-muted-foreground">Submission deadline</p>
                  <p className={submissionCountdown?.overdue ? "text-destructive" : ""}>
                    {submissionCountdown
                      ? submissionCountdown.overdue
                        ? "Overdue"
                        : `${submissionCountdown.daysRemaining} day(s) remaining`
                      : "—"}
                  </p>
                </div>
                <div
                  className="rounded-md border px-3 py-2"
                  data-testid="sla-deadline"
                >
                  <p className="text-xs text-muted-foreground">Dispute resolution SLA</p>
                  <p className={slaCountdown?.overdue ? "text-destructive" : ""}>
                    {slaCountdown
                      ? slaCountdown.overdue
                        ? "Overdue"
                        : `${slaCountdown.daysRemaining} day(s) remaining`
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          ) : record.status === "evidence_ready" ? (
            <form action={submitClaimAction} className="space-y-3" data-testid="submit-claim-form">
              <input type="hidden" name="organizationId" value={orgId} />
              <input type="hidden" name="caseId" value={record.id} />
              <div className="space-y-1">
                <Label htmlFor="externalReference">Marketplace ticket / reference</Label>
                <Input id="externalReference" name="externalReference" required placeholder="e.g. TAK-12345" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="submittedAt">Submission date</Label>
                <Input id="submittedAt" name="submittedAt" type="date" required />
              </div>
              <Button type="submit" size="sm">
                Mark claim submitted
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Move the case to <em>evidence ready</em> to record a manual claim submission.
            </p>
          )}

          <p className="text-xs text-muted-foreground" data-testid="disclaimer">
            {EVIDENCE_DISCLAIMER}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit trail</CardTitle>
          <CardDescription>Every material state change is recorded.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="audit-trail">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2">When</th>
                  <th>Event</th>
                  <th>From</th>
                  <th>To</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="py-2 font-mono text-xs">{e.createdAt}</td>
                    <td>{e.eventType}</td>
                    <td>{e.fromStatus ?? "—"}</td>
                    <td>{e.toStatus ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evidence</CardTitle>
          <CardDescription>Carried from the accepted candidate; stays traceable.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm" data-testid="case-evidence">
            {evidence.map((ev) => (
              <li key={`${ev.role}-${ev.eventId}`} className="font-mono text-xs">
                {ev.role}: {ev.eventId}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
