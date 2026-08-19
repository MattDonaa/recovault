import { transitionCandidateAction } from "@/app/money-finder-actions";
import { Button } from "@/components/ui/button";
import {
  CANDIDATE_STATUSES,
  canTransition,
  type CandidateStatus,
} from "@/core/recovery/workflow";

const LABELS: Record<CandidateStatus, string> = {
  detected: "Reset to detected",
  investigating: "Start investigating",
  accepted: "Accept",
  dismissed: "Dismiss",
};

/** Renders only the transitions valid from the candidate's current status. */
export function TransitionButtons({
  organizationId,
  candidateId,
  status,
}: {
  organizationId: string;
  candidateId: string;
  status: CandidateStatus;
}) {
  const targets = CANDIDATE_STATUSES.filter((s) => canTransition(status, s));
  if (targets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This recovery candidate is closed ({status}).
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2" data-testid="transition-buttons">
      {targets.map((to) => (
        <form key={to} action={transitionCandidateAction}>
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="candidateId" value={candidateId} />
          <input type="hidden" name="to" value={to} />
          <Button
            type="submit"
            size="sm"
            variant={to === "dismissed" ? "outline" : "default"}
          >
            {LABELS[to]}
          </Button>
        </form>
      ))}
    </div>
  );
}
