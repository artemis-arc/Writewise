"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronDownIcon, SparkleIcon } from "@/components/ui/icons";
import type { FeedbackEntry, FeedbackStatus } from "@/features/editor/useFeedback";

interface FeedbackPanelProps {
  readonly status: FeedbackStatus;
  readonly pendingStage: string | null;
  readonly history: readonly FeedbackEntry[];
  readonly error: string | null;
  readonly onDismissError?: () => void;
}

const STAGE_LABEL: Record<string, string> = {
  PLANNING: "Planning",
  IMPLEMENTATION: "Drafting",
  REVISION: "Revising",
};

function stageLabel(stage: string | null) {
  if (!stage) return "";
  return STAGE_LABEL[stage] ?? stage.toLowerCase();
}

function relativeTime(timestamp: number) {
  const minutes = Math.floor((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? "1 hr ago" : `${hours} hrs ago`;
}

function FeedbackBody({ text }: { readonly text: string }) {
  const paragraphs = text.split(/\n{2,}/).filter((part) => part.trim().length > 0);

  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed text-foreground/85">
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 24)}`} className="whitespace-pre-wrap">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

function GeneratingBody({ stage }: { readonly stage: string | null }) {
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <p className="flex items-center gap-2 text-sm text-foreground/70">
        <span className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand" />
        </span>
        {stage ? `Reading your ${stageLabel(stage).toLowerCase()} draft...` : "Writing feedback..."}
      </p>

      <div className="flex flex-col gap-2" aria-hidden>
        <span className="h-3 w-full animate-pulse rounded bg-surface-muted" />
        <span className="h-3 w-[92%] animate-pulse rounded bg-surface-muted" />
        <span className="h-3 w-[78%] animate-pulse rounded bg-surface-muted" />
      </div>
    </div>
  );
}

/**
 * Module 3's feedback, shown as it lands. One stage transition produces one entry:
 * the panel flips to its generating state the moment Module 2 reports the change,
 * then swaps the text in when the backend answers.
 */
export function FeedbackPanel(props: Readonly<FeedbackPanelProps>) {
  const { status, pendingStage, history, error, onDismissError } = props;
  const [isOpen, setIsOpen] = useState(true);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [latest, ...earlier] = history;
  const isGenerating = status === "generating";
  const hasContent = isGenerating || latest !== undefined || error !== null;

  return (
    <aside
      className={clsx(
        "flex w-80 shrink-0 flex-col border-l border-border-subtle bg-surface",
        !isOpen && "w-auto",
      )}
      aria-label="Writing feedback"
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-3 text-left text-sm font-semibold text-foreground"
      >
        <span className="flex items-center gap-2">
          <SparkleIcon
            className={clsx("h-4 w-4 text-brand", isGenerating && "animate-pulse")}
          />
          Feedback
          {isGenerating && (
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-brand uppercase">
              Live
            </span>
          )}
        </span>
        <ChevronDownIcon
          className={clsx("h-4 w-4 shrink-0 transition-transform", isOpen ? "" : "-rotate-90")}
        />
      </button>

      {isOpen && (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          {!hasContent && (
            <p className="text-sm text-foreground/50">
              Keep writing. Feedback arrives each time you move between planning,
              drafting and revising.
            </p>
          )}

          {error !== null && (
            <div className="rounded-xl border border-border-subtle bg-surface-muted p-3">
              <p className="text-sm text-foreground/80">{error}</p>
              {onDismissError && (
                <button
                  type="button"
                  onClick={onDismissError}
                  className="mt-2 text-xs font-medium text-brand underline-offset-2 hover:underline"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}

          {isGenerating && <GeneratingBody stage={pendingStage} />}

          {latest !== undefined && (
            <article className="flex flex-col gap-2">
              <header className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold tracking-wide text-brand uppercase">
                  {stageLabel(latest.stage)}
                </span>
                <span className="text-xs text-foreground/45">
                  {relativeTime(latest.receivedAt)}
                </span>
              </header>

              <FeedbackBody text={latest.feedback} />
            </article>
          )}

          {earlier.length > 0 && (
            <div className="border-t border-border-subtle pt-3">
              <button
                type="button"
                onClick={() => setIsHistoryOpen((open) => !open)}
                aria-expanded={isHistoryOpen}
                className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-foreground/60"
              >
                Earlier feedback ({earlier.length})
                <ChevronDownIcon
                  className={clsx(
                    "h-3.5 w-3.5 shrink-0 transition-transform",
                    isHistoryOpen ? "" : "-rotate-90",
                  )}
                />
              </button>

              {isHistoryOpen && (
                <div className="mt-3 flex flex-col gap-4">
                  {earlier.map((entry) => (
                    <article key={entry.id} className="flex flex-col gap-1.5 opacity-70">
                      <header className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-semibold tracking-wide text-foreground/60 uppercase">
                          {stageLabel(entry.stage)}
                        </span>
                        <span className="text-xs text-foreground/45">
                          {relativeTime(entry.receivedAt)}
                        </span>
                      </header>
                      <FeedbackBody text={entry.feedback} />
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
