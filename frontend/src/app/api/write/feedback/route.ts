import { NextResponse } from "next/server";
import { BACKEND_BASE_URL } from "@/lib/backend/config";
import { getAuthHeader } from "@/lib/backend/authHeaders";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    session_id?: unknown;
    stage?: unknown;
    content?: unknown;
  } | null;

  const sessionId = typeof body?.session_id === "string" ? body.session_id : null;
  const stage = typeof body?.stage === "string" ? body.stage : null;
  const content = typeof body?.content === "string" ? body.content : "";

  if (!sessionId) {
    return NextResponse.json({ error: "A session_id is required." }, { status: 400 });
  }

  if (!stage) {
    return NextResponse.json({ error: "A stage is required." }, { status: 400 });
  }

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/v1/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
      body: JSON.stringify({ session_id: sessionId, stage, content }),
    });

    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error("Failed to fetch feedback from backend:", error);
    return NextResponse.json(
      {
        error:
          "Could not generate feedback. Is the backend service running at " +
          "TASK_DEFINITION_BACKEND_URL (default http://localhost:8000)?",
      },
      { status: 502 },
    );
  }
}