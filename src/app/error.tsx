"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Segment error boundary. Shows a sanitized, generic message (never a raw stack
 * or sensitive detail) and offers a recovery action.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report via the console boundary; server-side capture handles the details.
    console.error(JSON.stringify({ level: "error", message: "ui_error_boundary", digest: error.digest }));
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-2xl font-bold tracking-tight">
        Something went wrong
      </h1>
      <p className="text-sm text-muted-foreground">
        An unexpected error occurred. No sensitive information is shown. You can
        try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
