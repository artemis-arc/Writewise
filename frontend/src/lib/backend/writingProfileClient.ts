import { BACKEND_BASE_URL } from "@/lib/backend/config";
import { getAuthHeader } from "@/lib/backend/authHeaders";
import { BackendHttpError } from "@/lib/backend/errors";
import type { WritingProfile } from "@/features/task-definition/types";

const WRITING_PROFILE_TIMEOUT_MS = 120_000;

interface BackendWritingProfileResponse {
  mechanics: number;
  organization: number;
  overall: number;
  submission_id?: string | null;
}

/**
 * Calls the FastAPI service in backend/ (app/api/routes/writing_profile.py), which wraps
 * the SRSD scoring model plus the mechanics evaluation pipeline. Organization is backed
 * by the trained model and mechanics by the LLM scoring pipeline. Vocabulary is deferred
 * to future work and intentionally not scored.
 */
export async function fetchWritingProfile(
  file: File,
  signal?: AbortSignal,
): Promise<WritingProfile> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WRITING_PROFILE_TIMEOUT_MS);
  signal?.addEventListener("abort", () => controller.abort());

  const formData = new FormData();
  formData.append("file", file, file.name);

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/v1/writing-profile`, {
      method: "POST",
      headers: await getAuthHeader(),
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      throw new BackendHttpError(
        detail?.detail ?? `Backend responded with ${response.status}`,
        response.status,
      );
    }

    const data: BackendWritingProfileResponse = await response.json();
    return {
      mechanics: data.mechanics,
      organization: data.organization,
      overall: data.overall,
      submissionId: data.submission_id ?? null,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
