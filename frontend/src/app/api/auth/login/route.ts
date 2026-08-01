import { NextResponse } from "next/server";
import { login } from "@/lib/backend/authClient";
import { setSessionCookies } from "@/lib/auth/setSessionCookies";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : null;
  const password = typeof body?.password === "string" ? body.password : null;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  try {
    const session = await login(email, password);
    await setSessionCookies(session);
    return NextResponse.json({ user: session.user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed.";
    const status = message.includes("Invalid email or password") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
