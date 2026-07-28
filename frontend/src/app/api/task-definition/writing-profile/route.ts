import { NextResponse } from "next/server";
import { fetchWritingProfile } from "@/lib/backend/writingProfileClient";

/**
 * Proxies the uploaded manuscript to the FastAPI service in backend/, which extracts
 * its text and runs it through the trained SRSD scoring model. This route is the only
 * place that knows the backend exists -- taskDefinitionService.ts and every component
 * still only see a WritingProfile.
 */
export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
  }

  try {
    const writingProfile = await fetchWritingProfile(file);
    return NextResponse.json(writingProfile);
  } catch (error) {
    console.error("Failed to fetch writing profile from backend:", error);
    return NextResponse.json(
      {
        error:
          "Could not score the uploaded document. Is the backend service running at " +
          "TASK_DEFINITION_BACKEND_URL (default http://localhost:8000)?",
      },
      { status: 502 },
    );
  }
}
