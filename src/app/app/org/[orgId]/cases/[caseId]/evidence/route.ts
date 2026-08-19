import { NextResponse } from "next/server";

import { getSessionUser } from "@/core/auth/guards";
import { getMembershipStore } from "@/lib/auth";
import { buildCaseEvidence } from "@/lib/evidence/build";
import { renderEvidencePdf } from "@/lib/evidence/pdf";

/**
 * Server-generated PDF evidence pack. Requires an authenticated member of the
 * organization; a non-member (or cross-tenant case) gets a 404. Content is
 * built only from persisted case/candidate/source data.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; caseId: string }> },
) {
  const { orgId, caseId } = await params;

  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const store = await getMembershipStore();
  const membership = await store.getMembership(user.id, orgId);
  if (!membership) return new NextResponse("Not found", { status: 404 });

  const pack = buildCaseEvidence(orgId, caseId, new Date().toISOString());
  if (!pack) return new NextResponse("Not found", { status: 404 });

  const pdf = await renderEvidencePdf(pack);
  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="evidence-${caseId}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
