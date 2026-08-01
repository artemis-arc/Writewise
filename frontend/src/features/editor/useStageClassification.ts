"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { M2_CONFIDENCE_CUTOFF, M2_DEBOUNCE_MS, STAGE_CLASSIFICATION_PROXY_PATH } from "@/lib/backend/config";

const IS_DEV = process.env.NODE_ENV !== "production";

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

function getUnixTimestamp() {
  return Date.now();
}

async function postStageClassificationBatch(events: StageClassificationEventRecord[], signal?: AbortSignal) {
  if (IS_DEV) {
    console.log("[m2] sending batch", { count: events.length, events });
  }

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

  const payload = (await response.json()) as {
    events: Array<{ stage: string; confidence: number }>;
    latest: { stage: string; confidence: number } | null;
  };

  if (IS_DEV) {
    console.log("[m2] batch response", payload);
  }

  return payload;
}

export function useStageClassification(editor: Editor | null, options: UseStageClassificationOptions = {}) {
  const debounceMs = options.debounceMs ?? M2_DEBOUNCE_MS;
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bufferRef = useRef<StageClassificationEventRecord[]>([]);
  const lastTextRef = useRef("");
  const debounceTimerRef = useRef<number | null>(null);
  const isSendingRef = useRef(false);
  const needsFlushRef = useRef(false);
  const isMountedRef = useRef(false);
  const inFlightAbortRef = useRef<AbortController | null>(null);
  const confidenceCutoffRef = useRef(options.confidenceCutoff ?? M2_CONFIDENCE_CUTOFF);
  const onStageChangeRef = useRef(options.onStageChange);

  useEffect(() => {
    confidenceCutoffRef.current = options.confidenceCutoff ?? M2_CONFIDENCE_CUTOFF;
    onStageChangeRef.current = options.onStageChange;
  }, [options.confidenceCutoff, options.onStageChange]);

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
        isConfident: confidence >= confidenceCutoffRef.current,
      };

      setSignal(nextSignal);
      onStageChangeRef.current?.(nextSignal);
    },
    [],
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

    if (IS_DEV) {
      console.log("[m2] flushing batch", { count: batch.length, batch });
    }

    bufferRef.current = [];
    isSendingRef.current = true;
    const abortController = new AbortController();
    inFlightAbortRef.current = abortController;

    try {
      const result = await postStageClassificationBatch(batch, abortController.signal);
      const latest = result.latest ?? result.events.at(-1) ?? null;
      if (latest) {
        if (IS_DEV) {
          console.log("[m2] latest classification", latest);
        }

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
          debounceTimerRef.current = null;
          void flushBuffer();
        }, debounceMs);
      } else {
        needsFlushRef.current = false;
      }
    }
  }, [debounceMs, publishSignal]);

  const scheduleFlush = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      return;
    }

    if (IS_DEV) {
      console.info("[m2] debounce armed", { delayMs: debounceMs, bufferedEvents: bufferRef.current.length });
    }

    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      if (IS_DEV) {
        console.info("[m2] debounce fired", { bufferedEvents: bufferRef.current.length });
      }
      void flushBuffer();
    }, debounceMs);
  }, [debounceMs, flushBuffer]);

  const recordEvent = useCallback(
    (currentText: string, timestamp: number) => {
      const beforeText = lastTextRef.current;
      bufferRef.current.push({ before_text: beforeText, after_text: currentText, timestamp });
      if (IS_DEV) {
        console.info("[m2] queued event", {
          bufferedEvents: bufferRef.current.length,
          beforeTextLength: beforeText.length,
          afterTextLength: currentText.length,
          timestamp,
        });
      }
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

    const handleKeyUp = () => {
      recordEvent(editor.getText(), getUnixTimestamp());
    };

    const handleScroll = () => {
      recordEvent(editor.getText(), getUnixTimestamp());
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

      debounceTimerRef.current = null;

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
