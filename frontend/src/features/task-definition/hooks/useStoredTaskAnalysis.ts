"use client";

import { useSyncExternalStore } from "react";
import {
  getServerTaskAnalysisSnapshot,
  getTaskAnalysisSnapshot,
  subscribeToTaskAnalysis,
} from "@/features/task-definition/storage";
import type { TaskDefinitionAnalysis } from "@/features/task-definition/types";

/**
 * The task breakdown the writer last generated, for surfaces reached without going
 * back through the wizard. Reads null on the server and during hydration, then the
 * stored value -- and re-renders if the wizard saves or clears one while mounted.
 */
export function useStoredTaskAnalysis(enabled = true): TaskDefinitionAnalysis | null {
  const analysis = useSyncExternalStore(
    subscribeToTaskAnalysis,
    getTaskAnalysisSnapshot,
    getServerTaskAnalysisSnapshot,
  );

  return enabled ? analysis : null;
}
