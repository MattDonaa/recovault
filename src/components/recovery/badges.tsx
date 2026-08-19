import { cn } from "@/lib/utils";
import type { Confidence } from "@/core/recovery/types";
import type { CandidateStatus } from "@/core/recovery/workflow";

const base = "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold";

/** Confidence badge. Gold family for medium; navy/blue for high; slate for low. */
export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const styles: Record<Confidence, string> = {
    HIGH: "bg-primary/10 text-primary",
    MEDIUM: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
    LOW: "bg-muted text-muted-foreground",
  };
  return (
    <span data-testid="confidence-badge" className={cn(base, styles[confidence])}>
      {confidence}
    </span>
  );
}

/** Status badge, aligned to the brand status colour guidance. */
export function StatusBadge({ status }: { status: CandidateStatus }) {
  const styles: Record<CandidateStatus, string> = {
    detected: "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200",
    investigating:
      "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
    accepted: "bg-primary/10 text-primary",
    dismissed: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  };
  return (
    <span data-testid="status-badge" className={cn(base, styles[status])}>
      {status}
    </span>
  );
}
