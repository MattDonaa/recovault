import Link from "next/link";
import { redirect } from "next/navigation";

import { loginAction } from "@/app/auth-actions";
import { CredentialsForm } from "@/components/auth/credentials-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionUser } from "@/core/auth/guards";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getSessionUser()) redirect("/app");
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Log in</CardTitle>
          <CardDescription>Access your RecoVault workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CredentialsForm
            action={loginAction}
            submitLabel="Log in"
            next={next}
          />
          <p className="text-sm text-muted-foreground">
            No account?{" "}
            <Link href="/signup" className="font-medium underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
