import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from "@/lib/auth/cookies";

const PROTECTED_ROUTES = ["/task-definition", "/dashboard", "/profile"];
const AUTH_ROUTES = ["/login", "/signup"];

/**
 * Optimistic, cookie-presence-only gate -- real verification happens server-side in FastAPI
 * (app/auth/deps.py::get_current_user) on every actual API call, so an expired/forged cookie
 * here just means the page loads and then the first API call 401s.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession =
    request.cookies.has(ACCESS_COOKIE_NAME) || request.cookies.has(REFRESH_COOKIE_NAME);

  if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route)) && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (AUTH_ROUTES.includes(pathname) && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/task-definition/:path*", "/dashboard/:path*", "/profile/:path*", "/login", "/signup"],
};
