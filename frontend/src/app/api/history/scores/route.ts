import { NextResponse } from "next/server";
import { fetchScoreHistory } from "@/lib/backend/historyClient";
import { BackendHttpError } from "@/lib/backend/errors";

export async function GET() {
  try {
    const scores = await fetchScoreHistory();
    return NextResponse.json(scores);
  } catch (error) {
    if (error instanceof BackendHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to fetch score history:", error);
    return NextResponse.json({ error: "Could not load score history." }, { status: 502 });
  }
}
