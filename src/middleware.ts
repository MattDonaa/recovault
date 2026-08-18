import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/core/auth/constants";

/**
 * Coarse edge guard: redirect unauthenticated requests away from the protected
 * app shell before they reach the server components. This is a fast first line
 * only — the real authorization (signature verification + membership) is
 * enforced server-side in `requireSession` / `requireOrgAccess`.
 */
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
