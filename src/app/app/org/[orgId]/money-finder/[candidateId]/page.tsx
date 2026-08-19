import Link from "next/link";
import { notFound } from "next/navigation";

import { createCaseAction } from "@/app/case-actions";
import { Button } from "@/components/ui/button";
import { findCaseByCandidateId } from "@/lib/cases/memory-store";
import { MockBanner } from "@/components/marketplace/mock-banner";
import { ConfidenceBadge, StatusBadge } from "@/components/recovery/badges";
import { TransitionButtons } from "@/components/recovery/transition-buttons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireOrgAccess } from "@/core/auth/guards";
import { formatMoneyMinor } from "@/core/money/format";
import { isMockMode } from "@/lib/auth";
import { getCandidate } from "@/lib/marketplace/money-finder-store";

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; candidateId: string }>;
}) {
  const { orgId, candidateId } = await params;
  await requireOrgAccess(orgId);

  const found = getCandidate(orgId, candidateId);
  if (!found) notFound();
  const { candidate, evidence } = found;
  const existingCase = findCaseByCandidateId(candidate.id);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href={`/app/org/${orgId}/money-finder`}
          className="text-sm text-muted-foreground underline"
        >
          ← Back to Money Finder
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {candidate.title}
          </h1>
          <ConfidenceBadge confidence={candidate.confidence} />
          <StatusBadge status={candidate.status} />
        </div>
        <p className="text-sm text-muted-foreground">{candidate.summary}</p>
      </div>

      {isMockMode() ? <MockBanner /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Potential recovery</CardTitle>
            <CardDescription>Anomaly detected by a deterministic rule.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <p
              data-testid="candidate-amount"
              className="font-display text-2xl font-bold tabular-nums text-primary"
            >
              {formatMoneyMinor(candidate.potentialRecoveryMinor, candidate.currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              Rule {candidate.ruleId} · version {candidate.ruleVersion} · confidence
              score {candidate.confidenceScore}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workflow</CardTitle>
            <CardDescription>
              Move this recovery candidate through review. Transitions are recorded.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TransitionButtons
              organizationId={orgId}
              candidateId={candidate.id}
              status={candidate.status}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recovery case</CardTitle>
          <CardDescription>
            Turn an accepted candidate into a controlled, auditable recovery case.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {existingCase ? (
            <Link
              href={`/app/org/${orgId}/cases/${existingCase.id}`}
              className="text-sm font-medium text-primary underline"
              data-testid="view-case"
            >
              View recovery case ({existingCase.status}) →
            </Link>
          ) : candidate.status === "accepted" ? (
            <form action={createCaseAction}>
              <input type="hidden" name="organizationId" value={orgId} />
              <input type="hidden" name="candidateId" value={candidate.id} />
              <Button type="submit" size="sm" data-testid="create-case">
                Create recovery case
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Accept this candidate first to create a recovery case.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calculation</CardTitle>
          <CardDescription>Exact, deterministic inputs behind this candidate.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre
            data-testid="calculation"
            className="overflow-x-auto rounded-md bg-muted p-3 text-xs"
          >
            {JSON.stringify(candidate.calculation, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evidence trace</CardTitle>
          <CardDescription>
            Each candidate links to the ledger events (and their source records)
            that justify it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="evidence-table">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2">Role</th>
                  <th>Event</th>
                  <th>Type</th>
                  <th>Source record</th>
                </tr>
              </thead>
              <tbody>
                {evidence.map(({ role, event }) => (
                  <tr key={`${role}-${event.id}`} className="border-t">
                    <td className="py-2">{role}</td>
                    <td className="font-mono text-xs">{event.eventKey}</td>
                    <td>{event.eventType}</td>
                    <td className="font-mono text-xs">{event.sourceRecordId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
