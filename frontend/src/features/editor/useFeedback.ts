"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const FEEDBACK_PROXY_PATH = "/api/write/feedback";

const IS_DEV =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

export type FeedbackStatus = "idle" | "generating" | "ready" | "error";

export interface FeedbackScores {
  relevance: number;
  clarity: number;
  actionability: number;
  stage_alignment: number;
  improvement_impact: number;
  consistency_with_history: number;
}

export interface FeedbackDiagnostics {
  action: string;
  action_index: number;
  used_rl_action: boolean;
  baseline_state: number;
  final_state: number;
  reward: number;
  scores: FeedbackScores;
  strategies: string[];
}

export interface FeedbackResponse {
  feedback: string;
  stage: string;
  writer_level: string;
  diagnostics: FeedbackDiagnostics;
}

export interface FeedbackEntry {
  id: string;
  feedback: string;
  stage: string;
  writerLevel: string;
  diagnostics: FeedbackDiagnostics | null;
  receivedAt: number;
}

export interface FeedbackRequestInput {
  sessionId: string;
  stage: string;
  content: string;
}

export interface UseFeedbackResult {
  status: FeedbackStatus;
  /** The stage whose transition is currently being written about, while `status` is "generating". */
  pendingStage: string | null;
  /** Most recent feedback, or null until the first one lands. */
  latest: FeedbackEntry | null;
  /** Newest first, latest included. */
  history: FeedbackEntry[];
  error: string | null;
  requestFeedback: (input: FeedbackRequestInput) => void;
  dismissError: () => void;
}

function messageForStatus(status: number, detail: string | null) {
  if (detail) {
    return detail;
  }

  if (status === 409) {
    return "No writing profile yet -- upload a document on the profile page to get feedback.";
  }

  if (status === 503) {
    return "The feedback scorer is unavailable right now. Feedback will resume on the next stage change.";
  }

  return `Feedback request failed (${status}).`;
}

/**
 * Owns Module 3's feedback for the session: one request per stage transition, its
 * in-flight state, and every response so far.
 *
 * The backend answers in one shot after several seconds of generation and scoring,
 * so "live" here means the panel shows the generating state the moment a transition
 * fires and swaps in the text when it arrives -- there is no token stream to follow.
 *
 * TODO: stream the text token by token. Needs the backend first -- POST
 * /api/v1/feedback is a blocking sync route that returns one complete
 * FeedbackResponse, so it would have to expose an SSE variant that forwards
 * Gemini's own stream (text deltas first, then the Module 4 scores and
 * diagnostics as a final event, since those cannot be computed until the
 * feedback is whole). On this side: read the response with EventSource or a
 * fetch ReadableStream, append deltas onto a `streamingText` field, and have
 * FeedbackPanel render that instead of the skeleton while status is
 * "generating". The abort-on-newer-transition rule below carries over unchanged.
 */
export function useFeedback(): UseFeedbackResult {
  const [status, setStatus] = useState<FeedbackStatus>("idle");
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const [history, setHistory] = useState<FeedbackEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const inFlightAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      inFlightAbortRef.current?.abort();
      inFlightAbortRef.current = null;
    };
  }, []);

  const requestFeedback = useCallback((input: FeedbackRequestInput) => {
    // A newer transition supersedes whatever was still generating: the writer has
    // moved on, and the older feedback would describe a draft that no longer exists.
    inFlightAbortRef.current?.abort();

    const abortController = new AbortController();
    inFlightAbortRef.current = abortController;

    setStatus("generating");
    setPendingStage(input.stage);
    setError(null);

    void (async () => {
      try {
        const response = await fetch(FEEDBACK_PROXY_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: input.sessionId,
            stage: input.stage,
            content: input.content,
          }),
          signal: abortController.signal,
        });

        if (!isMountedRef.current || abortController.signal.aborted) {
          return;
        }

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: unknown;
            detail?: unknown;
          } | null;

          // 422 means Module 2 has not recorded a boundary for this session yet.
          // That is the normal state early in a document, not something to show.
          if (response.status === 422) {
            setStatus((current) => (current === "generating" ? "idle" : current));
            setPendingStage(null);
            return;
          }

          const detail =
            typeof payload?.error === "string"
              ? payload.error
              : typeof payload?.detail === "string"
                ? payload.detail
                : null;

          setStatus("error");
          setPendingStage(null);
          setError(messageForStatus(response.status, detail));
          return;
        }

        const payload = (await response.json()) as FeedbackResponse;

        if (!isMountedRef.current || abortController.signal.aborted) {
          return;
        }

        if (IS_DEV) {
          console.info("[m3] feedback", payload);
        }

        const entry: FeedbackEntry = {
          id:
            typeof window !== "undefined" && window.crypto?.randomUUID
              ? window.crypto.randomUUID()
              : `${Date.now()}`,
          feedback: payload.feedback,
          stage: payload.stage ?? input.stage,
          writerLevel: payload.writer_level,
          diagnostics: payload.diagnostics ?? null,
          receivedAt: Date.now(),
        };

        setHistory((entries) => [entry, ...entries]);
        setStatus("ready");
        setPendingStage(null);
      } catch (caught) {
        if (abortController.signal.aborted || !isMountedRef.current) {
          return;
        }

        console.warn("[m3] feedback request failed", caught);
        setStatus("error");
        setPendingStage(null);
        setError("Could not reach the feedback service.");
      } finally {
        if (inFlightAbortRef.current === abortController) {
          inFlightAbortRef.current = null;
        }
      }
    })();
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
    setStatus((current) => (current === "error" ? "idle" : current));
  }, []);

  return {
    status,
    pendingStage,
    latest: history[0] ?? null,
    history,
    error,
    requestFeedback,
    dismissError,
  };
}
