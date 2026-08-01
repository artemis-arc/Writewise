"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const AUTOSAVE_DELAY_MS = 2000;

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseDraftAutosaveResult {
  status: SaveStatus;
  notifyChange: (content: string) => void;
}

/**
 * Debounced draft persistence for the writing editor. Creates the backing
 * WritingSubmission row on the first edit, then upserts it on every subsequent
 * pause in typing so a refresh never loses the draft.
 */
export function useDraftAutosave(): UseDraftAutosaveResult {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const draftIdRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContentRef = useRef<string>("");

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const save = useCallback(async (content: string) => {
    setStatus("saving");
    try {
      if (!draftIdRef.current) {
        const response = await fetch("/api/writings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentText: content }),
        });
        if (!response.ok) throw new Error("Failed to create draft");
        const data = await response.json();
        draftIdRef.current = data.id;
      } else {
        const response = await fetch(`/api/writings/${draftIdRef.current}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentText: content }),
        });
        if (!response.ok) throw new Error("Failed to update draft");
      }
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }, []);

  const notifyChange = useCallback(
    (content: string) => {
      latestContentRef.current = content;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        save(latestContentRef.current);
      }, AUTOSAVE_DELAY_MS);
    },
    [save],
  );

  return { status, notifyChange };
}
