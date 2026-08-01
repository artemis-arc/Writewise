import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { fetchCurrentUser, refreshSession } from "@/lib/backend/authClient";
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from "@/lib/auth/cookies";
import { clearSessionCookies, setSessionCookies } from "@/lib/auth/setSessionCookies";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value;

  if (accessToken) {
    const user = await fetchCurrentUser(accessToken).catch(() => null);
    if (user) return NextResponse.json({ user });
  }

  // Access token missing/expired -- attempt one silent refresh before giving up.
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;
  if (!refreshToken) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  try {
    const session = await refreshSession(refreshToken);
    await setSessionCookies(session);
    return NextResponse.json({ user: session.user });
  } catch {
    await clearSessionCookies();
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
