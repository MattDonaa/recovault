import { FlaskConical } from "lucide-react";

/**
 * Always-visible banner marking synthetic/demo financial data. Required on any
 * mock-derived financial screen so figures are never mistaken for real
 * recoveries.
 */
export function MockBanner() {
  return (
    <div
      data-testid="mock-banner"
      role="note"
      className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <FlaskConical className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        <strong>MOCK / DEMO data.</strong> These figures are synthetic. RecoVault
        never presents mock data as real recoveries.
      </span>
    </div>
  );
}
