import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { logout } from "@/lib/backend/authClient";
import { REFRESH_COOKIE_NAME } from "@/lib/auth/cookies";
import { clearSessionCookies } from "@/lib/auth/setSessionCookies";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;

  if (refreshToken) {
    await logout(refreshToken).catch(() => {
      // Best-effort revoke -- the cookies get cleared regardless so the user is logged out client-side.
    });
  }

  await clearSessionCookies();
  return NextResponse.json({ ok: true });
}
