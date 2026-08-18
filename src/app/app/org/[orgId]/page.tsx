import Link from "next/link";

import { ConnectMarketplaceForm } from "@/components/marketplace/connect-marketplace-form";
import { LiveConnectForm } from "@/components/marketplace/live-connect-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireOrgAccess } from "@/core/auth/guards";
import { listScenarioSummaries } from "@/integrations/mock/fixtures";
import { listConnections } from "@/lib/marketplace/mock-accounts";

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  // Server-side authorization: non-members get a 404 here, regardless of UI.
  const { membership } = await requireOrgAccess(orgId);
  const connections = listConnections(orgId);
  const scenarios = listScenarioSummaries().map((s) => ({
    key: s.key,
    label: s.label,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/app" className="text-sm text-muted-foreground underline">
          ← All organizations
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {membership.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {membership.slug} · your role: {membership.role}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Marketplace connections</CardTitle>
          <CardDescription>
            Connect a MOCK demo (synthetic data) or a LIVE marketplace. Live keys
            are stored encrypted and are never marked verified without a real
            successful connection check.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {connections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No marketplace connected yet.
            </p>
          ) : (
            <ul className="space-y-2" data-testid="connections">
              {connections.map((c) => (
                <li key={c.id} className="text-sm">
                  <Link
                    href={`/app/org/${orgId}/marketplace/${c.id}`}
                    className="font-medium underline"
                  >
                    {c.displayName}
                  </Link>{" "}
                  <span
                    className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold uppercase text-muted-foreground"
                    data-testid={`mode-${c.id}`}
                  >
                    {c.mode}
                  </span>{" "}
                  <span className="text-xs text-muted-foreground" data-testid={`status-${c.id}`}>
                    · {c.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Connect a demo
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                MOCK
              </span>
            </CardTitle>
            <CardDescription>Synthetic data only — never a real seller.</CardDescription>
          </CardHeader>
          <CardContent>
            <ConnectMarketplaceForm organizationId={orgId} scenarios={scenarios} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Connect Takealot
              <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                LIVE
              </span>
            </CardTitle>
            <CardDescription>
              Requires a real API key. Encrypted at rest; verified only by a real
              connection check.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LiveConnectForm organizationId={orgId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
