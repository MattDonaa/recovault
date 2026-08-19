import Link from "next/link";
import { notFound } from "next/navigation";

import { CaseTransitionButtons } from "@/components/cases/case-transition-buttons";
import { MockBanner } from "@/components/marketplace/mock-banner";
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
          <CardContent>
            <CaseTransitionButtons organizationId={orgId} caseId={record.id} status={record.status} />
          </CardContent>
        </Card>
      </div>

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
