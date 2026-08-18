"use client";

import { useActionState } from "react";

import {
  connectLiveTakealotAction,
  type MarketplaceFormState,
} from "@/app/marketplace-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LiveConnectForm({ organizationId }: { organizationId: string }) {
  const [state, formAction, pending] = useActionState<
    MarketplaceFormState,
    FormData
  >(connectLiveTakealotAction, {});

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="organizationId" value={organizationId} />
      <div className="space-y-2">
        <Label htmlFor="displayName">Connection name</Label>
        <Input id="displayName" name="displayName" type="text" placeholder="Takealot (LIVE)" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="apiKey">Takealot API key</Label>
        <Input
          id="apiKey"
          name="apiKey"
          type="password"
          autoComplete="off"
          placeholder="X-API-Key value"
          required
        />
        <p className="text-xs text-muted-foreground">
          Stored encrypted, server-side only. It is never shown again and is not
          verified until a live check succeeds.
        </p>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Add live connection"}
      </Button>
    </form>
  );
}
