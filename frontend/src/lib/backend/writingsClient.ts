import { BACKEND_BASE_URL } from "@/lib/backend/config";
import { getAuthHeader } from "@/lib/backend/authHeaders";
import { BackendHttpError } from "@/lib/backend/errors";

export interface DraftResponse {
  id: string;
  contentText: string;
  updatedAt: string;
}

interface BackendDraftResponse {
  id: string;
  content_text: string;
  updated_at: string;
}

function toDraftResponse(data: BackendDraftResponse): DraftResponse {
  return { id: data.id, contentText: data.content_text, updatedAt: data.updated_at };
}

async function request(path: string, method: "POST" | "PUT", body: unknown): Promise<DraftResponse> {
  const response = await fetch(`${BACKEND_BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new BackendHttpError(
      detail?.detail ?? `Backend responded with ${response.status}`,
      response.status,
    );
  }

  return toDraftResponse(await response.json());
}

export function createDraft(contentText: string): Promise<DraftResponse> {
  return request("/api/v1/writings", "POST", { content_text: contentText });
}

export function updateDraft(draftId: string, contentText: string): Promise<DraftResponse> {
  return request(`/api/v1/writings/${draftId}`, "PUT", { content_text: contentText });
}
