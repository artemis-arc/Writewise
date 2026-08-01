import { NextResponse } from "next/server";
import { fetchSubmissionHistory } from "@/lib/backend/historyClient";
import { BackendHttpError } from "@/lib/backend/errors";

export async function GET() {
  try {
    const submissions = await fetchSubmissionHistory();
    return NextResponse.json(submissions);
  } catch (error) {
    if (error instanceof BackendHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to fetch submission history:", error);
    return NextResponse.json({ error: "Could not load submission history." }, { status: 502 });
  }
}
