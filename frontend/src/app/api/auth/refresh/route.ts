import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { refreshSession } from "@/lib/backend/authClient";
import { REFRESH_COOKIE_NAME } from "@/lib/auth/cookies";
import { clearSessionCookies, setSessionCookies } from "@/lib/auth/setSessionCookies";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const session = await refreshSession(refreshToken);
    await setSessionCookies(session);
    return NextResponse.json({ user: session.user });
  } catch (error) {
    await clearSessionCookies();
    const message = error instanceof Error ? error.message : "Session expired.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
