"use client";

import { useCallback, useRef, useState } from "react";
import {
  getTaskBreakdown,
  getWritingProfile,
  submitTask,
} from "@/features/task-definition/services/taskDefinitionService";
import { clearTaskAnalysis, saveTaskAnalysis } from "@/features/task-definition/storage";
import type {
  TaskDefinitionAnalysis,
  TaskDefinitionInput,
} from "@/features/task-definition/types";
import { ApiError } from "@/lib/api/client";

type Status = "idle" | "loading" | "success" | "error";

interface UseTaskDefinitionAnalysisResult {
  status: Status;
  analysis: TaskDefinitionAnalysis | null;
  error: string | null;
  runAnalysis: (input: TaskDefinitionInput, writingSample: File) => Promise<void>;
  reset: () => void;
}

/**
 * Orchestrates the Task Definition → Analysis step: submits the task, scores the
 * uploaded writing sample, then fetches the task breakdown (which needs those scores
 * to pick suitable actions). Keeping this sequencing here (instead of inside the page
 * component) means the UI only ever reacts to status/analysis/error.
 */
export function useTaskDefinitionAnalysis(): UseTaskDefinitionAnalysisResult {
  const [status, setStatus] = useState<Status>("idle");
  const [analysis, setAnalysis] = useState<TaskDefinitionAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runAnalysis = useCallback(async (input: TaskDefinitionInput, writingSample: File) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setError(null);

    try {
      const { taskId } = await submitTask(input, controller.signal);
      const writingProfile = await getWritingProfile(writingSample, controller.signal);
      const breakdown = await getTaskBreakdown(input, writingProfile, controller.signal);

      const nextAnalysis = { taskId, writingProfile, breakdown };

      // Also parked in session storage so the milestones and guidance follow the
      // writer to /write, which has no wizard state to inherit and no backend
      // endpoint to re-read a breakdown from.
      saveTaskAnalysis(nextAnalysis);

      setAnalysis(nextAnalysis);
      setStatus("success");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong while generating your analysis. Please try again.",
      );
      setStatus("error");
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    clearTaskAnalysis();
    setStatus("idle");
    setAnalysis(null);
    setError(null);
  }, []);

  return { status, analysis, error, runAnalysis, reset };
}
