import { NextResponse } from "next/server";
import { BACKEND_BASE_URL, STAGE_CLASSIFICATION_BATCH_BACKEND_PATH } from "@/lib/backend/config";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    session_id?: unknown;
    events?: unknown[];
  } | null;
  const sessionId = typeof body?.session_id === "string" ? body.session_id : null;
  const events = body?.events ?? null;

  if (!sessionId) {
    return NextResponse.json({ error: "A session_id is required." }, { status: 400 });
  }

  if (!events || events.length === 0) {
    return NextResponse.json({ error: "At least one event is required." }, { status: 400 });
  }

  try {
    const response = await fetch(`${BACKEND_BASE_URL}${STAGE_CLASSIFICATION_BATCH_BACKEND_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, events }),
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      throw new Error(detail?.detail ?? `Backend responded with ${response.status}`);
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Failed to fetch stage classification from backend:", error);
    return NextResponse.json(
      {
        error:
          "Could not classify the writing stage. Is the backend service running at " +
          "TASK_DEFINITION_BACKEND_URL (default http://localhost:8000)?",
      },
      { status: 502 },
    );
  }
}
