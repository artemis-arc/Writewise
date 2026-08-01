/** Base URL of the FastAPI service (backend/) that wraps task_define.ipynb's logic. */
export const BACKEND_BASE_URL =
  (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env?.TASK_DEFINITION_BACKEND_URL ?? "http://localhost:8000";

/** Backend path for Module 2 stage classification. */
export const STAGE_CLASSIFICATION_BACKEND_PATH =
  (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env?.M2_STAGE_CLASSIFICATION_BACKEND_PATH ?? "/api/v1/stage-classification";

/** Backend path for Module 2 batch stage classification. */
export const STAGE_CLASSIFICATION_BATCH_BACKEND_PATH =
  (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env?.M2_STAGE_CLASSIFICATION_BATCH_BACKEND_PATH ?? "/api/v1/stage-classification/batch";

/** Browser proxy route for the stage-classification batch endpoint. */
export const STAGE_CLASSIFICATION_PROXY_PATH =
  (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env?.NEXT_PUBLIC_M2_STAGE_CLASSIFICATION_PROXY_PATH ?? "/api/write/stage-classification";

/** Engineering debounce used to batch editor events before transport. */
export const M2_DEBOUNCE_MS = Number(
  (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env?.NEXT_PUBLIC_M2_DEBOUNCE_MS ?? "500",
);

/** Confidence threshold used for UI emphasis, not for model inference. */
export const M2_CONFIDENCE_CUTOFF = Number(
  (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env?.NEXT_PUBLIC_M2_CONFIDENCE_CUTOFF ?? "0.6",
);
