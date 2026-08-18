"use client";

import { useActionState } from "react";

import {
  rotateCredentialAction,
  type MarketplaceFormState,
} from "@/app/marketplace-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RotateKeyForm({
  organizationId,
  connectionId,
}: {
  organizationId: string;
  connectionId: string;
}) {
  const [state, formAction, pending] = useActionState<
    MarketplaceFormState,
    FormData
  >(rotateCredentialAction, {});

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="connectionId" value={connectionId} />
      <Label htmlFor="rotateApiKey">Replace API key</Label>
      <Input
        id="rotateApiKey"
        name="apiKey"
        type="password"
        autoComplete="off"
        placeholder="New X-API-Key value"
        required
      />
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Updating…" : "Replace key"}
      </Button>
    </form>
  );
}
