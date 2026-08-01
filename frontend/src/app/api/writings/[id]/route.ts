import { NextResponse } from "next/server";
import { updateDraft } from "@/lib/backend/writingsClient";
import { BackendHttpError } from "@/lib/backend/errors";

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const contentText = typeof body?.contentText === "string" ? body.contentText : "";

  try {
    const draft = await updateDraft(id, contentText);
    return NextResponse.json(draft);
  } catch (error) {
    if (error instanceof BackendHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to update draft:", error);
    return NextResponse.json({ error: "Could not save draft." }, { status: 502 });
  }
}
