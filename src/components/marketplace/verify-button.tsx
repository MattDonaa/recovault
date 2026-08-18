import { verifyConnectionAction } from "@/app/marketplace-actions";
import { Button } from "@/components/ui/button";

export function VerifyButton({
  organizationId,
  connectionId,
}: {
  organizationId: string;
  connectionId: string;
}) {
  return (
    <form action={verifyConnectionAction}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="connectionId" value={connectionId} />
      <Button type="submit" size="sm">
        Verify connection
      </Button>
    </form>
  );
}
