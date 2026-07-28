import { NextResponse } from "next/server";
import { taskBreakdownRequestSchema } from "@/features/task-definition/schema";
import { fetchTaskBreakdown } from "@/lib/backend/taskBreakdownClient";

/**
 * Proxies to the FastAPI service in backend/ (task_define.ipynb's FAISS + Gemini
 * pipeline, wrapped for HTTP). This route is the only place that knows the backend
 * exists — taskDefinitionService.ts and every component still only see TaskBreakdown.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = taskBreakdownRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid task definition input." },
      { status: 400 },
    );
  }

  try {
    const breakdown = await fetchTaskBreakdown(parsed.data);
    return NextResponse.json(breakdown);
  } catch (error) {
    console.error("Failed to fetch task breakdown from backend:", error);
    return NextResponse.json(
      {
        error:
          "Could not generate the task breakdown. Is the backend service running at " +
          "TASK_DEFINITION_BACKEND_URL (default http://localhost:8000)?",
      },
      { status: 502 },
    );
  }
}
