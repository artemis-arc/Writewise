import {
  BACKEND_BASE_URL,
  STAGE_CLASSIFICATION_BACKEND_PATH,
  STAGE_CLASSIFICATION_BATCH_BACKEND_PATH,
} from "@/lib/backend/config";

export interface StageClassificationRequest {
  before_text: string;
  after_text: string;
  timestamp: number;
}

export interface StageClassificationResponse {
  stage: string;
  confidence: number;
  before_text: string;
  after_text: string;
  timestamp: number;
}

export interface StageClassificationBatchRequest {
  events: StageClassificationRequest[];
}

export interface StageClassificationBatchResponse {
  events: StageClassificationResponse[];
  latest: StageClassificationResponse | null;
}

export async function fetchStageClassification(
  input: StageClassificationRequest,
  signal?: AbortSignal,
): Promise<StageClassificationResponse> {
  const response = await fetch(`${BACKEND_BASE_URL}${STAGE_CLASSIFICATION_BACKEND_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `Backend responded with ${response.status}`);
  }

  return (await response.json()) as StageClassificationResponse;
}

export async function fetchStageClassificationBatch(
  input: StageClassificationBatchRequest,
  signal?: AbortSignal,
): Promise<StageClassificationBatchResponse> {
  const response = await fetch(`${BACKEND_BASE_URL}${STAGE_CLASSIFICATION_BATCH_BACKEND_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `Backend responded with ${response.status}`);
  }

  return (await response.json()) as StageClassificationBatchResponse;
}
