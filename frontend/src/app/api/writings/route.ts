import { NextResponse } from "next/server";
import { createDraft } from "@/lib/backend/writingsClient";
import { BackendHttpError } from "@/lib/backend/errors";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const contentText = typeof body?.contentText === "string" ? body.contentText : "";

  try {
    const draft = await createDraft(contentText);
    return NextResponse.json(draft, { status: 201 });
  } catch (error) {
    if (error instanceof BackendHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to create draft:", error);
    return NextResponse.json({ error: "Could not save draft." }, { status: 502 });
  }
}
