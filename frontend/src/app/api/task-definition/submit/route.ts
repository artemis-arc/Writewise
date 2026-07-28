import { NextResponse } from "next/server";
import { taskDefinitionSchema } from "@/features/task-definition/schema";
import type { SubmitTaskResult } from "@/features/task-definition/types";

/**
 * Registers the task input. Today this just validates and mints an in-memory id;
 * later it will persist the task server-side (e.g. forwarding to the Python backend)
 * so writing-profile/breakdown lookups can be keyed off taskId instead of resubmitting data.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = taskDefinitionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid task definition input." },
      { status: 400 },
    );
  }

  const result: SubmitTaskResult = { taskId: crypto.randomUUID() };
  return NextResponse.json(result);
}
