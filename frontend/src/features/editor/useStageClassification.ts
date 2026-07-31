"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { M2_CONFIDENCE_CUTOFF, M2_DEBOUNCE_MS, STAGE_CLASSIFICATION_PROXY_PATH } from "@/lib/backend/config";

export interface StageClassificationEventRecord {
  before_text: string;
  after_text: string;
  timestamp: number;
}

export interface StageClassificationSignal {
  stage: string | null;
  confidence: number | null;
  isConfident: boolean;
}

export interface UseStageClassificationOptions {
  debounceMs?: number;
  confidenceCutoff?: number;
  onStageChange?: (signal: StageClassificationSignal) => void;
}

async function postStageClassificationBatch(events: StageClassificationEventRecord[], signal?: AbortSignal) {
  const response = await fetch(STAGE_CLASSIFICATION_PROXY_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events }),
    signal,
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error ?? detail?.detail ?? `Proxy responded with ${response.status}`);
  }

  return (await response.json()) as {
    events: Array<{ stage: string; confidence: number }>;
    latest: { stage: string; confidence: number } | null;
  };
}

export function useStageClassification(editor: Editor | null, options: UseStageClassificationOptions = {}) {
  const debounceMs = options.debounceMs ?? M2_DEBOUNCE_MS;
  const confidenceCutoff = options.confidenceCutoff ?? M2_CONFIDENCE_CUTOFF;
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bufferRef = useRef<StageClassificationEventRecord[]>([]);
  const lastTextRef = useRef("");
  const debounceTimerRef = useRef<number | null>(null);
  const isSendingRef = useRef(false);
  const needsFlushRef = useRef(false);
  const isMountedRef = useRef(false);
  const inFlightAbortRef = useRef<AbortController | null>(null);

  const [signal, setSignal] = useState<StageClassificationSignal>({
    stage: null,
    confidence: null,
    isConfident: false,
  });

  const publishSignal = useCallback(
    (stage: string, confidence: number) => {
      if (!isMountedRef.current) {
        return;
      }

      const nextSignal: StageClassificationSignal = {
        stage,
        confidence,
        isConfident: confidence >= confidenceCutoff,
      };

      setSignal(nextSignal);
      options.onStageChange?.(nextSignal);
    },
    [confidenceCutoff, options],
  );

  const flushBuffer = useCallback(async () => {
    if (!isMountedRef.current) {
      return;
    }

    if (isSendingRef.current) {
      needsFlushRef.current = true;
      return;
    }

    const batch = bufferRef.current;
    if (batch.length === 0) {
      return;
    }

    bufferRef.current = [];
    isSendingRef.current = true;
    const abortController = new AbortController();
    inFlightAbortRef.current = abortController;

    try {
      const result = await postStageClassificationBatch(batch, abortController.signal);
      const latest = result.latest ?? result.events.at(-1) ?? null;
      if (latest) {
        publishSignal(latest.stage, latest.confidence);
      }
    } catch (error) {
      if (!abortController.signal.aborted && isMountedRef.current) {
        console.error("Failed to classify writing stage:", error);
      }
    } finally {
      if (inFlightAbortRef.current === abortController) {
        inFlightAbortRef.current = null;
      }

      isSendingRef.current = false;

      if (isMountedRef.current && (bufferRef.current.length > 0 || needsFlushRef.current)) {
        needsFlushRef.current = false;
        debounceTimerRef.current = window.setTimeout(() => {
          void flushBuffer();
        }, debounceMs);
      } else {
        needsFlushRef.current = false;
      }
    }
  }, [debounceMs, publishSignal]);

  const scheduleFlush = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      void flushBuffer();
    }, debounceMs);
  }, [debounceMs, flushBuffer]);

  const recordEvent = useCallback(
    (currentText: string, timestamp: number) => {
      const beforeText = lastTextRef.current;
      bufferRef.current.push({ before_text: beforeText, after_text: currentText, timestamp });
      lastTextRef.current = currentText;
      scheduleFlush();
    },
    [scheduleFlush],
  );

  useEffect(() => {
    if (!editor) {
      return;
    }

    isMountedRef.current = true;
    lastTextRef.current = editor.getText();

    const handleKeyUp = (event: KeyboardEvent) => {
      recordEvent(editor.getText(), event.timeStamp);
    };

    const handleScroll = (event: Event) => {
      recordEvent(editor.getText(), event.timeStamp);
    };

    const editorDom = editor.view.dom;
    const scrollContainer = scrollContainerRef.current;

    editorDom.addEventListener("keyup", handleKeyUp);
    scrollContainer?.addEventListener("scroll", handleScroll);

    return () => {
      isMountedRef.current = false;
      editorDom.removeEventListener("keyup", handleKeyUp);
      scrollContainer?.removeEventListener("scroll", handleScroll);

      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }

      inFlightAbortRef.current?.abort();
      inFlightAbortRef.current = null;

      bufferRef.current = [];
      needsFlushRef.current = false;
    };
  }, [editor, flushBuffer, recordEvent]);

  return {
    scrollContainerRef,
    signal,
  };
}
