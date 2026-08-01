import { BACKEND_BASE_URL } from "@/lib/backend/config";
import { getAuthHeader } from "@/lib/backend/authHeaders";
import { BackendHttpError } from "@/lib/backend/errors";
import type { ScoreHistoryEntry, SubmissionSummary } from "@/features/history/types";

interface BackendScoreEntry {
  id: string;
  submission_id: string;
  mechanics: number;
  organization: number;
  overall: number;
  scored_at: string;
  source: string;
  original_filename: string | null;
  task: string | null;
}

interface BackendSubmissionSummary {
  id: string;
  source: string;
  original_filename: string | null;
  excerpt: string;
  created_at: string;
  updated_at: string;
  latest_overall_score: number | null;
}

async function getJson<TResponse>(path: string): Promise<TResponse> {
  const response = await fetch(`${BACKEND_BASE_URL}${path}`, {
    headers: await getAuthHeader(),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new BackendHttpError(
      detail?.detail ?? `Backend responded with ${response.status}`,
      response.status,
    );
  }

  return (await response.json()) as TResponse;
}

export async function fetchScoreHistory(): Promise<ScoreHistoryEntry[]> {
  const data = await getJson<BackendScoreEntry[]>("/api/v1/history/scores");
  return data.map((entry) => ({
    id: entry.id,
    submissionId: entry.submission_id,
    mechanics: entry.mechanics,
    organization: entry.organization,
    overall: entry.overall,
    scoredAt: entry.scored_at,
    source: entry.source,
    originalFilename: entry.original_filename,
    task: entry.task,
  }));
}

export async function fetchSubmissionHistory(): Promise<SubmissionSummary[]> {
  const data = await getJson<BackendSubmissionSummary[]>("/api/v1/history/submissions");
  return data.map((entry) => ({
    id: entry.id,
    source: entry.source,
    originalFilename: entry.original_filename,
    excerpt: entry.excerpt,
    createdAt: entry.created_at,
    updatedAt: entry.updated_at,
    latestOverallScore: entry.latest_overall_score,
  }));
}
