import Link from "next/link";

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
import { listOrgCases } from "@/lib/cases/memory-store";

export default async function CasesPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrgAccess(orgId);
  const cases = listOrgCases(orgId);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href={`/app/org/${orgId}`} className="text-sm text-muted-foreground underline">
          ← Back to organization
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-tight">Recovery cases</h1>
        <p className="text-sm text-muted-foreground">
          Accepted recovery candidates promoted to controlled, auditable cases.
        </p>
      </div>

      {isMockMode() ? <MockBanner /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cases</CardTitle>
          <CardDescription>Each case tracks a recovery through its lifecycle.</CardDescription>
        </CardHeader>
        <CardContent>
          {cases.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No cases yet. Accept a recovery candidate in Money Finder, then create a case.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="cases-table">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2">Case</th>
                    <th>Rule</th>
                    <th>Status</th>
                    <th className="text-right">Potential</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="py-2">
                        <Link
                          href={`/app/org/${orgId}/cases/${c.id}`}
                          className="font-medium underline"
                        >
                          {c.title}
                        </Link>
                      </td>
                      <td>{c.ruleId}</td>
                      <td>{c.status.replace(/_/g, " ")}</td>
                      <td className="text-right tabular-nums">
                        {formatMoneyMinor(c.potentialRecoveryMinor, c.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
