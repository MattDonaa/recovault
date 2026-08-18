"use client";

import { useActionState } from "react";

import {
  connectMockMarketplaceAction,
  type MarketplaceFormState,
} from "@/app/marketplace-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface ScenarioOption {
  key: string;
  label: string;
}

export function ConnectMarketplaceForm({
  organizationId,
  scenarios,
}: {
  organizationId: string;
  scenarios: ScenarioOption[];
}) {
  const [state, formAction, pending] = useActionState<
    MarketplaceFormState,
    FormData
  >(connectMockMarketplaceAction, {});

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="organizationId" value={organizationId} />
      <div className="space-y-2">
        <Label htmlFor="scenarioKey">Demo scenario</Label>
        <select
          id="scenarioKey"
          name="scenarioKey"
          required
          defaultValue=""
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="" disabled>
            Choose a synthetic scenario…
          </option>
          {scenarios.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Connecting…" : "Connect demo marketplace (MOCK)"}
      </Button>
    </form>
  );
}
