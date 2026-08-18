import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireOrgAccess } from "@/core/auth/guards";

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  // Server-side authorization: non-members get a 404 here, regardless of UI.
  const { membership } = await requireOrgAccess(orgId);

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
            No marketplace is connected yet. Connecting accounts and syncing data
            arrive in a later milestone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This workspace has no data to show. RecoVault never displays
            fabricated recovery figures.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
