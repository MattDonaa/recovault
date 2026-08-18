import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireOrgAccess } from "@/core/auth/guards";
import { collectAll } from "@/core/marketplace/pagination";
import { MockMarketplaceAdapter } from "@/integrations/mock/adapter";
import { getScenario } from "@/integrations/mock/fixtures";
import { getMockAccount } from "@/lib/marketplace/mock-accounts";

export default async function MockMarketplaceAccountPage({
  params,
}: {
  params: Promise<{ orgId: string; accountId: string }>;
}) {
  const { orgId, accountId } = await params;
  await requireOrgAccess(orgId);

  const account = getMockAccount(orgId, accountId);
  if (!account) notFound();

  const scenario = getScenario(account.scenarioKey);
  if (!scenario) notFound();

  const adapter = new MockMarketplaceAdapter(scenario);
  const connection = await adapter.verifyConnection();
  const seller = await adapter.listSellerMetadata();

  const [offers, sales, returns, shipments, transactions, balances] =
    await Promise.all([
      collectAll((c) => adapter.listOffers({ cursor: c })),
      collectAll((c) => adapter.listSales({ cursor: c })),
      collectAll((c) => adapter.listReturns({ cursor: c })),
      collectAll((c) => adapter.listShipments({ cursor: c })),
      collectAll((c) => adapter.listTransactions({ cursor: c })),
      adapter.listBalances(),
    ]);

  const quarantinedTotal =
    offers.quarantined.length +
    sales.quarantined.length +
    returns.quarantined.length +
    shipments.quarantined.length +
    transactions.quarantined.length;

  const rows: { kind: string; count: number }[] = [
    { kind: "Offers", count: offers.records.length },
    { kind: "Sales", count: sales.records.length },
    { kind: "Returns", count: returns.records.length },
    { kind: "Shipments", count: shipments.records.length },
    { kind: "Transactions", count: transactions.records.length },
    { kind: "Balances", count: balances.length },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href={`/app/org/${orgId}`}
          className="text-sm text-muted-foreground underline"
        >
          ← Back to organization
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {account.displayName}
          </h1>
          <span
            data-testid="mock-badge"
            className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
          >
            MOCK · synthetic data
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {connection.message} · seller: {seller.displayName}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{scenario.manifest.label}</CardTitle>
          <CardDescription>{scenario.manifest.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {rows.map((r) => (
              <li
                key={r.kind}
                className="rounded-md border px-3 py-2 text-sm"
                data-testid={`count-${r.kind.toLowerCase()}`}
              >
                <span className="font-medium">{r.kind}:</span> {r.count}
              </li>
            ))}
          </ul>
          {quarantinedTotal > 0 ? (
            <p
              className="text-sm text-destructive"
              data-testid="quarantined-note"
            >
              {quarantinedTotal} malformed record(s) were quarantined (fail
              closed) and not normalized.
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            All figures are derived from synthetic fixtures. RecoVault never
            presents mock data as real recoveries.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
