import { cookies } from "next/headers";
import type { AuthSession } from "@/features/auth/types";
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from "@/lib/auth/cookies";

/** Persists a freshly issued token pair as httpOnly cookies on the outgoing response. */
export async function setSessionCookies(session: AuthSession): Promise<void> {
  const cookieStore = await cookies();
  const isProd = process.env.NODE_ENV === "production";

  cookieStore.set(ACCESS_COOKIE_NAME, session.tokens.accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: session.tokens.accessTokenExpiresIn,
  });

  cookieStore.set(REFRESH_COOKIE_NAME, session.tokens.refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: session.tokens.refreshTokenExpiresIn,
  });
}

export async function clearSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE_NAME);
  cookieStore.set(REFRESH_COOKIE_NAME, "", { path: REFRESH_COOKIE_PATH, maxAge: 0 });
}
