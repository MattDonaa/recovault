import { NextResponse } from "next/server";

import { env } from "@/lib/env";

/**
 * Minimal liveness/health endpoint. Returns non-sensitive application status.
 * No secrets, no marketplace data, no tenant information.
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    app: env.NEXT_PUBLIC_APP_NAME,
    environment: env.NEXT_PUBLIC_APP_ENV,
    milestone: "01-foundation",
  });
}
