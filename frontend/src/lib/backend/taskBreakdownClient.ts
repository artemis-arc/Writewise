import { BACKEND_BASE_URL } from "@/lib/backend/config";
import { getAuthHeader } from "@/lib/backend/authHeaders";
import { BackendHttpError } from "@/lib/backend/errors";
import type { TaskBreakdownRequestValues } from "@/features/task-definition/schema";
import type { TaskBreakdown, TaskMilestone } from "@/features/task-definition/types";

interface BackendMilestone {
  order: number;
  title: string;
  description: string;
}

interface BackendActionSet {
  mechanics: string[];
  organization: string[];
}

interface BackendTaskBreakdownResponse {
  milestones: BackendMilestone[];
  actions: BackendActionSet;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Calls the FastAPI service in backend/ (app/api/routes/task_breakdown.py), which wraps
 * task_define.ipynb's FAISS retrieval + Gemini generation. This is the one place that
 * knows the backend's wire format; everything upstream deals only in TaskBreakdown.
 */
export async function fetchTaskBreakdown(
  input: TaskBreakdownRequestValues,
  signal?: AbortSignal,
): Promise<TaskBreakdown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  signal?.addEventListener("abort", () => controller.abort());

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/v1/task-breakdown`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
      body: JSON.stringify({
        task: input.question,
        academic_level: input.academicLevel,
        citation_style: input.citationStyle,
        writing_profile: {
          mechanics: input.writingProfile.mechanics,
          organization: input.writingProfile.organization,
        },
        submission_id: input.writingProfile.submissionId ?? null,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      throw new BackendHttpError(
        detail?.detail ?? `Backend responded with ${response.status}`,
        response.status,
      );
    }

    const data: BackendTaskBreakdownResponse = await response.json();

    const milestones: TaskMilestone[] = data.milestones.map((milestone) => ({
      id: slugify(milestone.title),
      order: milestone.order,
      title: milestone.title,
      description: milestone.description,
      completed: false,
    }));

    return { milestones, actions: data.actions };
  } finally {
    clearTimeout(timeoutId);
  }
}
