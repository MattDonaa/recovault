import Link from "next/link";

import { ConnectMarketplaceForm } from "@/components/marketplace/connect-marketplace-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireOrgAccess } from "@/core/auth/guards";
import { listScenarioSummaries } from "@/integrations/mock/fixtures";
import { listMockAccounts } from "@/lib/marketplace/mock-accounts";

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  // Server-side authorization: non-members get a 404 here, regardless of UI.
  const { membership } = await requireOrgAccess(orgId);
  const accounts = listMockAccounts(orgId);
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
          <CardTitle className="flex items-center gap-2">
            Marketplace connections
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
              MOCK
            </span>
          </CardTitle>
          <CardDescription>
            Demo connections use synthetic data only — never a real seller. Live
            marketplace connection arrives in a later milestone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No demo marketplace connected yet.
            </p>
          ) : (
            <ul className="space-y-2" data-testid="mock-accounts">
              {accounts.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/app/org/${orgId}/marketplace/${a.id}`}
                    className="text-sm font-medium underline"
                  >
                    {a.displayName}
                  </Link>{" "}
                  <span className="text-xs text-muted-foreground">
                    · {a.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <ConnectMarketplaceForm organizationId={orgId} scenarios={scenarios} />
        </CardContent>
      </Card>
    </div>
  );
}
