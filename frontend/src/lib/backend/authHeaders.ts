import { cookies } from "next/headers";
import { ACCESS_COOKIE_NAME } from "@/lib/auth/cookies";

/** Forwards the caller's access-token cookie to the FastAPI backend as a Bearer header. */
export async function getAuthHeader(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}
