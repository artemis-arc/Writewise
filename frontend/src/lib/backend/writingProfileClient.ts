import { BACKEND_BASE_URL } from "@/lib/backend/config";
import type { WritingProfile } from "@/features/task-definition/types";

/**
 * Calls the FastAPI service in backend/ (app/api/routes/writing_profile.py), which wraps
 * the SRSD scoring model plus the mechanics evaluation pipeline. Organization is backed
 * by the trained model, mechanics now comes from the LLM scoring pipeline, and vocabulary
 * is still a backend placeholder (see backend/app/services/srsd_scoring.py) until labeled
 * data exists for that dimension.
 */
export async function fetchWritingProfile(
  file: File,
  signal?: AbortSignal,
): Promise<WritingProfile> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);
  signal?.addEventListener("abort", () => controller.abort());

  const formData = new FormData();
  formData.append("file", file, file.name);

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/v1/writing-profile`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      throw new Error(detail?.detail ?? `Backend responded with ${response.status}`);
    }

    return (await response.json()) as WritingProfile;
  } finally {
    clearTimeout(timeoutId);
  }
}
