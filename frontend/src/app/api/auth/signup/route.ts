import { NextResponse } from "next/server";
import { signup } from "@/lib/backend/authClient";
import { setSessionCookies } from "@/lib/auth/setSessionCookies";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : null;
  const password = typeof body?.password === "string" ? body.password : null;
  const displayName = typeof body?.displayName === "string" ? body.displayName : undefined;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  try {
    const session = await signup(email, password, displayName);
    await setSessionCookies(session);
    return NextResponse.json({ user: session.user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signup failed.";
    const status = message.includes("already exists") ? 409 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
