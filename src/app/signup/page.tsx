import Link from "next/link";
import { redirect } from "next/navigation";

import { signupAction } from "@/app/auth-actions";
import { CredentialsForm } from "@/components/auth/credentials-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionUser } from "@/core/auth/guards";

export default async function SignupPage() {
  if (await getSessionUser()) redirect("/app");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <CardDescription>
            Start a RecoVault workspace. Passwords must be at least 8 characters.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CredentialsForm action={signupAction} submitLabel="Sign up" />
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
