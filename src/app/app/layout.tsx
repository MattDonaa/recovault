import Link from "next/link";

import { BrandLogo } from "@/components/brand/brand-logo";
import { LogoutButton } from "@/components/auth/logout-button";
import { requireSession } from "@/core/auth/guards";
import { isMockMode } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSession();

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link href="/app" className="flex items-center gap-2">
            <BrandLogo variant="symbol" className="h-7 w-7" priority />
            <span className="font-display text-lg font-bold tracking-tight text-primary">
              RecoVault
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {isMockMode() ? (
              <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                Mock mode
              </span>
            ) : null}
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
