import { apiRequest } from "@/lib/api/client";
import type {
  SubmitTaskResult,
  TaskBreakdown,
  TaskDefinitionInput,
  WritingProfile,
} from "@/features/task-definition/types";

const BASE_PATH = "/api/task-definition";

/**
 * Registers a task definition submission and returns its id.
 * Backed by a mock route today; will call the real backend later with no signature change.
 */
export function submitTask(
  input: TaskDefinitionInput,
  signal?: AbortSignal,
): Promise<SubmitTaskResult> {
  return apiRequest<SubmitTaskResult>(`${BASE_PATH}/submit`, {
    method: "POST",
    body: input,
    signal,
  });
}

/**
 * Scores the uploaded manuscript via the FastAPI service in backend/. Organization is backed
 * by the SRSD model, mechanics comes from the Gemini evaluation pipeline, and vocabulary is
 * still a backend placeholder until labeled data exists for that dimension.
 */
export function getWritingProfile(
  file: File,
  signal?: AbortSignal,
): Promise<WritingProfile> {
  const formData = new FormData();
  formData.append("file", file, file.name);

  return apiRequest<WritingProfile>(`${BASE_PATH}/writing-profile`, {
    method: "POST",
    body: formData,
    signal,
  });
}

/**
 * Fetches the generated task breakdown (milestones + support actions). Backed by the
 * FastAPI service in backend/ (task_define.ipynb's FAISS + Gemini pipeline), which needs
 * the writing profile scores to pick suitable actions -- so this must run after
 * getWritingProfile() resolves, not in parallel with it.
 */
export function getTaskBreakdown(
  input: TaskDefinitionInput,
  writingProfile: WritingProfile,
  signal?: AbortSignal,
): Promise<TaskBreakdown> {
  return apiRequest<TaskBreakdown>(`${BASE_PATH}/breakdown`, {
    method: "POST",
    body: { ...input, writingProfile },
    signal,
  });
}
