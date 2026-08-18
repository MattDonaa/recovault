import Link from "next/link";
import { notFound } from "next/navigation";

import { RotateKeyForm } from "@/components/marketplace/rotate-key-form";
import { VerifyButton } from "@/components/marketplace/verify-button";
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
import { getConnection } from "@/lib/marketplace/mock-accounts";

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "connected"
      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
      : status === "error"
        ? "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200"
        : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
  return (
    <span
      data-testid="connection-status"
      className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${color}`}
    >
      {status}
    </span>
  );
}

export default async function MarketplaceConnectionPage({
  params,
}: {
  params: Promise<{ orgId: string; accountId: string }>;
}) {
  const { orgId, accountId } = await params;
  await requireOrgAccess(orgId);

  const connection = getConnection(orgId, accountId);
  if (!connection) notFound();

  const isMock = connection.mode === "mock";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href={`/app/org/${orgId}`} className="text-sm text-muted-foreground underline">
          ← Back to organization
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {connection.displayName}
          </h1>
          <span
            data-testid="mode-badge"
            className="rounded bg-slate-200 px-2 py-0.5 text-xs font-semibold uppercase text-slate-700 dark:bg-slate-700 dark:text-slate-200"
          >
            {connection.mode}
          </span>
          <StatusBadge status={connection.status} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection status</CardTitle>
          <CardDescription>
            {connection.status === "connected"
              ? `Verified${connection.verifiedAt ? ` at ${connection.verifiedAt}` : ""}.`
              : "Not verified yet. A connection is only marked verified after a real successful check."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {connection.lastVerificationError ? (
            <p className="text-sm text-destructive" data-testid="verify-error">
              Last check failed: {connection.lastVerificationError}
            </p>
          ) : null}
          {!isMock ? (
            <p className="text-sm text-muted-foreground" data-testid="credential-state">
              Credential: {connection.hasCredential ? "stored (encrypted)" : "none"}
            </p>
          ) : null}
          <VerifyButton organizationId={orgId} connectionId={connection.id} />
        </CardContent>
      </Card>

      {isMock ? (
        <MockScenarioView orgId={orgId} scenarioKey={connection.scenarioKey} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Credential</CardTitle>
            <CardDescription>
              The API key is encrypted at rest and never displayed. You can
              replace it below; replacing resets verification.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RotateKeyForm organizationId={orgId} connectionId={connection.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

async function MockScenarioView({
  orgId,
  scenarioKey,
}: {
  orgId: string;
  scenarioKey: string | null;
}) {
  void orgId;
  const scenario = scenarioKey ? getScenario(scenarioKey) : undefined;
  if (!scenario) return null;

  const adapter = new MockMarketplaceAdapter(scenario);
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

  const rows = [
    { kind: "Offers", count: offers.records.length },
    { kind: "Sales", count: sales.records.length },
    { kind: "Returns", count: returns.records.length },
    { kind: "Shipments", count: shipments.records.length },
    { kind: "Transactions", count: transactions.records.length },
    { kind: "Balances", count: balances.length },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {scenario.manifest.label}
          <span
            data-testid="mock-badge"
            className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
          >
            MOCK · synthetic data
          </span>
        </CardTitle>
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
          <p className="text-sm text-destructive" data-testid="quarantined-note">
            {quarantinedTotal} malformed record(s) were quarantined (fail closed).
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          All figures are synthetic. RecoVault never presents mock data as real
          recoveries.
        </p>
      </CardContent>
    </Card>
  );
}
