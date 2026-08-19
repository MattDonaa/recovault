import Link from "next/link";
import { Coins, Search } from "lucide-react";

import { MockBanner } from "@/components/marketplace/mock-banner";
import { ConfidenceBadge, StatusBadge } from "@/components/recovery/badges";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireOrgAccess } from "@/core/auth/guards";
import { formatMoneyMinor } from "@/core/money/format";
import { computeTotals } from "@/core/recovery/totals";
import { isMockMode } from "@/lib/auth";
import {
  filterCandidates,
  listOrgCandidates,
} from "@/lib/marketplace/money-finder-store";
import { recoveredTotalMinor } from "@/lib/recovery/memory-recovery";

const RULES = ["MR-001", "MR-002", "MR-003"];
const CONFIDENCES = ["HIGH", "MEDIUM", "LOW"];
const STATUSES = ["detected", "investigating", "accepted", "dismissed"];

export default async function MoneyFinderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{
    rule?: string;
    confidence?: string;
    status?: string;
    marketplace?: string;
  }>;
}) {
  const { orgId } = await params;
  await requireOrgAccess(orgId);
  const filter = await searchParams;

  const all = listOrgCandidates(orgId);
  const totals = computeTotals(all); // totals reflect ALL candidates
  const filtered = filterCandidates(all, filter);
  const recoveredMinor = recoveredTotalMinor(orgId);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href={`/app/org/${orgId}`} className="text-sm text-muted-foreground underline">
          ← Back to organization
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-tight">Money Finder</h1>
        <p className="text-sm text-muted-foreground">
          Deterministic recovery candidates from your marketplace data. Figures are
          potential recovery, not confirmed amounts.
        </p>
      </div>

      {isMockMode() ? <MockBanner /> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-rv-gold" aria-hidden="true" />
              Potential recovery
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p
              data-testid="total-potential"
              className="font-display text-3xl font-bold tabular-nums text-primary"
            >
              {formatMoneyMinor(totals.potentialRecoveryMinor, totals.currency ?? "ZAR")}
            </p>
            <p className="text-xs text-muted-foreground">Across actionable candidates.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recovery candidates</CardDescription>
          </CardHeader>
          <CardContent>
            <p data-testid="total-candidates" className="text-3xl font-bold tabular-nums">
              {totals.candidateCount}
            </p>
            <p className="text-xs text-muted-foreground">
              {totals.dismissedCount} dismissed (still auditable).
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recovered (verified)</CardDescription>
          </CardHeader>
          <CardContent>
            <p
              data-testid="total-recovered"
              className="font-display text-3xl font-bold tabular-nums text-success"
            >
              {formatMoneyMinor(recoveredMinor, totals.currency ?? "ZAR")}
            </p>
            <p className="text-xs text-muted-foreground">Matched to a payment.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Candidates</CardTitle>
          <CardDescription>Filter by rule, confidence, status, or marketplace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="get" className="flex flex-wrap items-end gap-3" data-testid="filters">
            <FilterSelect name="rule" label="Rule" value={filter.rule} options={RULES} />
            <FilterSelect name="confidence" label="Confidence" value={filter.confidence} options={CONFIDENCES} />
            <FilterSelect name="status" label="Status" value={filter.status} options={STATUSES} />
            <FilterSelect name="marketplace" label="Marketplace" value={filter.marketplace} options={["mock", "takealot"]} />
            <button
              type="submit"
              className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Apply
            </button>
            <Link href={`/app/org/${orgId}/money-finder`} className="text-sm underline">
              Clear
            </Link>
          </form>

          {filtered.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Search className="h-4 w-4" aria-hidden="true" />
              No recovery candidates match. Connect a marketplace and run analysis.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="candidates-table">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2">Candidate</th>
                    <th>Rule</th>
                    <th>Confidence</th>
                    <th>Status</th>
                    <th className="text-right">Potential</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="py-2">
                        <Link
                          href={`/app/org/${orgId}/money-finder/${c.id}`}
                          className="font-medium underline"
                        >
                          {c.title}
                        </Link>
                      </td>
                      <td>{c.ruleId}</td>
                      <td><ConfidenceBadge confidence={c.confidence} /></td>
                      <td><StatusBadge status={c.status} /></td>
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

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string | undefined;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        name={name}
        defaultValue={value ?? ""}
        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-foreground"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
