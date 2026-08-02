"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";

const IS_DEV =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

const M2_DEBOUNCE_MS = 500;
const M2_CONFIDENCE_CUTOFF = 0.6;
const STAGE_CLASSIFICATION_PROXY_PATH = "/api/write/stage-classification";
const STAGE_CLASSIFICATION_SESSION_STORAGE_KEY = "writewise.stage-classification.session-id";

export interface StageClassificationEventRecord {
  before_text: string;
  after_text: string;
  timestamp: number;
}

export interface StageClassificationBatchRequest {
  session_id: string;
  events: StageClassificationEventRecord[];
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

function getOrCreateStageClassificationSessionId() {
  if (typeof window === "undefined") {
    return "server";
  }

  const existing = window.sessionStorage.getItem(STAGE_CLASSIFICATION_SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const nextSessionId = window.crypto.randomUUID();
  window.sessionStorage.setItem(STAGE_CLASSIFICATION_SESSION_STORAGE_KEY, nextSessionId);
  return nextSessionId;
}

async function postStageClassificationBatch(
  sessionId: string,
  events: StageClassificationEventRecord[],
  signal?: AbortSignal,
) {
  if (IS_DEV) {
    console.log("[m2] sending batch", { count: events.length, events });
  }

  const requestBody: StageClassificationBatchRequest = {
    session_id: sessionId,
    events,
  };

  const response = await fetch(STAGE_CLASSIFICATION_PROXY_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
    signal,
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error ?? detail?.detail ?? `Proxy responded with ${response.status}`);
  }

  const payload = (await response.json()) as {
    events: Array<{
      stage: string;
      confidence: number;
      before_text: string;
      after_text: string;
      timestamp: number;
    }>;
    latest: {
      stage: string;
      confidence: number;
      before_text: string;
      after_text: string;
      timestamp: number;
    } | null;
  };

  if (IS_DEV) {
    console.log("[m2] batch response", payload);
  }

  return payload;
}

export function useStageClassification(editor: Editor | null, options: UseStageClassificationOptions = {}) {
  const debounceMs = options.debounceMs ?? M2_DEBOUNCE_MS;
  const sessionIdRef = useRef(getOrCreateStageClassificationSessionId());
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bufferRef = useRef<StageClassificationEventRecord[]>([]);
  const lastTextRef = useRef("");
  const lastPublishedStageRef = useRef<string | null>(null);
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

      const previousStage = lastPublishedStageRef.current;
      lastPublishedStageRef.current = stage;

      if (previousStage !== null && previousStage !== stage) {
        const content = lastTextRef.current;
        void fetch("/api/write/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionIdRef.current,
            stage,
            content,
          }),
        })
          .then(async (response) => {
            if (response.ok) {
              if (IS_DEV) {
                console.info("[m3] auto-triggered feedback", await response.json());
              }
              return;
            }

            if (response.status === 422) {
              return;
            }

            const detail = await response.json().catch(() => null);
            console.warn("[m3] auto-trigger failed", detail ?? response.status);
          })
          .catch((error) => {
            console.warn("[m3] auto-trigger failed", error);
          });
      }
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
      const result = await postStageClassificationBatch(sessionIdRef.current, batch, abortController.signal);
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
