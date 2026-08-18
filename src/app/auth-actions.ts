"use server";

import { redirect } from "next/navigation";

import {
  clearSessionCookie,
  requireSession,
  setSessionCookie,
} from "@/core/auth/guards";
import { AuthError, type SessionUser } from "@/core/auth/types";
import {
  createOrganizationSchema,
  loginSchema,
  signupSchema,
  slugify,
} from "@/core/auth/validation";
import { getAuthProvider, getMembershipStore } from "@/lib/auth";

export interface FormState {
  error?: string;
}

function messageFor(error: unknown): string {
  if (error instanceof AuthError) return error.message;
  return "Something went wrong. Please try again.";
}

function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === "string" ? next : "";
  // Only allow internal, absolute app paths — never an open redirect.
  return value.startsWith("/app") ? value : "/app";
}

export async function signupAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let user: SessionUser;
  try {
    const provider = await getAuthProvider();
    user = await provider.signUp(parsed.data.email, parsed.data.password);
  } catch (error) {
    return { error: messageFor(error) };
  }

  await setSessionCookie(user);
  redirect("/app");
}

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let user: SessionUser;
  try {
    const provider = await getAuthProvider();
    user = await provider.signIn(parsed.data.email, parsed.data.password);
  } catch (error) {
    return { error: messageFor(error) };
  }

  await setSessionCookie(user);
  redirect(safeNext(formData.get("next")));
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

export async function createOrganizationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireSession();
  const parsed = createOrganizationSchema.safeParse({
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let organizationId: string;
  try {
    const store = await getMembershipStore();
    const org = await store.createOrganization(user.id, {
      name: parsed.data.name,
      slug: slugify(parsed.data.name),
    });
    organizationId = org.id;
  } catch (error) {
    return { error: messageFor(error) };
  }

  redirect(`/app/org/${organizationId}`);
}
