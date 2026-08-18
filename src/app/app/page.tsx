import Link from "next/link";

import { CreateOrgForm } from "@/components/auth/create-org-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSession } from "@/core/auth/guards";
import { getMembershipStore } from "@/lib/auth";

export default async function AppHomePage() {
  const user = await requireSession();
  const store = await getMembershipStore();
  const organizations = await store.listOrganizationsForUser(user.id);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Your organizations
        </h1>
        {organizations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You don&apos;t belong to any organization yet. Create one to get
            started.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {organizations.map((org) => (
              <li key={org.id}>
                <Link href={`/app/org/${org.id}`} className="block">
                  <Card className="transition-colors hover:bg-accent">
                    <CardHeader>
                      <CardTitle>{org.name}</CardTitle>
                      <CardDescription>
                        {org.slug} · {org.role}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Create an organization</CardTitle>
          <CardDescription>
            An organization is your tenant workspace. You become its owner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateOrgForm />
        </CardContent>
      </Card>
    </div>
  );
}
