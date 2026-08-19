import { transitionCaseAction } from "@/app/case-actions";
import { Button } from "@/components/ui/button";
import { allowedCaseTransitions, type CaseStatus } from "@/core/cases/status";

/** Renders only the case transitions valid from the current status. */
export function CaseTransitionButtons({
  organizationId,
  caseId,
  status,
}: {
  organizationId: string;
  caseId: string;
  status: CaseStatus;
}) {
  const targets = allowedCaseTransitions(status);
  if (targets.length === 0) {
    return <p className="text-sm text-muted-foreground">This case is closed.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2" data-testid="case-transitions">
      {targets.map((to) => (
        <form key={to} action={transitionCaseAction}>
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="to" value={to} />
          <Button type="submit" size="sm" variant={to === "closed" ? "outline" : "default"}>
            {to.replace(/_/g, " ")}
          </Button>
        </form>
      ))}
    </div>
  );
}
