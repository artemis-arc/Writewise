/** Base URL of the FastAPI service (backend/) that wraps task_define.ipynb's logic. */
export const BACKEND_BASE_URL =
  process.env.TASK_DEFINITION_BACKEND_URL ?? "http://localhost:8000";
