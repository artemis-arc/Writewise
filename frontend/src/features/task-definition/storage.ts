"use client";

import type { TaskDefinitionAnalysis } from "@/features/task-definition/types";

const STORAGE_KEY = "writewise.task-definition.analysis";

/**
 * The writer's current task breakdown, kept as a small external store so components
 * can subscribe to it.
 *
 * Session storage rather than local: the backend has no GET for a task breakdown
 * (POST /api/v1/task-breakdown regenerates one), so this is a carry-across between
 * routes in the same tab, not a durable record. It also means a shared browser does
 * not hand the next person the previous writer's task -- and `clearTaskAnalysis` on
 * logout closes the rest of that gap.
 */

const listeners = new Set<() => void>();

// `useSyncExternalStore` calls the snapshot getter on every render and compares by
// identity, so parsing afresh each time would loop forever. The raw string is the
// cache key: same string, same parsed object.
let cachedRaw: string | null = null;
let cachedAnalysis: TaskDefinitionAnalysis | null = null;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isTaskDefinitionAnalysis(value: unknown): value is TaskDefinitionAnalysis {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<TaskDefinitionAnalysis>;
  const breakdown = candidate.breakdown;

  if (typeof breakdown !== "object" || breakdown === null) {
    return false;
  }

  if (!Array.isArray(breakdown.milestones)) {
    return false;
  }

  const milestonesAreValid = breakdown.milestones.every(
    (milestone) =>
      typeof milestone?.id === "string" &&
      typeof milestone?.title === "string" &&
      typeof milestone?.order === "number",
  );

  return (
    milestonesAreValid &&
    isStringArray(breakdown.actions?.mechanics) &&
    isStringArray(breakdown.actions?.organization)
  );
}

function readRaw(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function saveTaskAnalysis(analysis: TaskDefinitionAnalysis) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(analysis));
  } catch {
    // A full or blocked storage is not worth failing an analysis over -- the
    // wizard still has the breakdown in memory for the step the writer is on.
  }

  emit();
}

export function clearTaskAnalysis() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to recover from -- the entry expires with the tab regardless.
  }

  emit();
}

export function subscribeToTaskAnalysis(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTaskAnalysisSnapshot(): TaskDefinitionAnalysis | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = readRaw();
  if (raw === cachedRaw) {
    return cachedAnalysis;
  }

  cachedRaw = raw;

  if (raw === null) {
    cachedAnalysis = null;
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    // Anything written by an older build of the app is ignored rather than
    // rendered: the editor should not break over a stale storage entry.
    cachedAnalysis = isTaskDefinitionAnalysis(parsed) ? parsed : null;
  } catch {
    cachedAnalysis = null;
  }

  return cachedAnalysis;
}

/** Nothing is in storage on the server, and claiming otherwise would break hydration. */
export function getServerTaskAnalysisSnapshot(): TaskDefinitionAnalysis | null {
  return null;
}
