import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { env } from "@/lib/env";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-8 w-8 text-primary" aria-hidden="true" />
        <h1 className="text-3xl font-semibold tracking-tight">
          {env.NEXT_PUBLIC_APP_NAME}
        </h1>
      </div>
      <p className="text-muted-foreground">
        Marketplace-agnostic revenue recovery. Foundation build — mock-first,
        no live marketplace data.
      </p>
      <p
        className="rounded-md border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
        data-testid="app-env"
      >
        Environment: {env.NEXT_PUBLIC_APP_ENV}
      </p>
      <div className="flex gap-3">
        <Link href="/signup" className={buttonVariants()}>
          Get started
        </Link>
        <Link href="/login" className={buttonVariants({ variant: "outline" })}>
          Log in
        </Link>
      </div>
    </main>
  );
}
