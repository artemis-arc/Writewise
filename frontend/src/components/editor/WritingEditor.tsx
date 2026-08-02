"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { EditorContent, useEditorState } from "@tiptap/react";
import clsx from "clsx";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { FeedbackPanel } from "@/components/editor/FeedbackPanel";
import { GuidePanel } from "@/components/editor/GuidePanel";
import { MilestoneSidebar } from "@/components/editor/MilestoneSidebar";
import { getPainterState } from "@/features/editor/extensions/formatPainter";
import { useDraftAutosave } from "@/features/editor/hooks/useDraftAutosave";
import { useFeedback } from "@/features/editor/useFeedback";
import { useManuscriptEditor } from "@/features/editor/useManuscriptEditor";
import { useStageClassification } from "@/features/editor/useStageClassification";
import { useStoredTaskAnalysis } from "@/features/task-definition/hooks/useStoredTaskAnalysis";
import type {
  StageClassificationSignal,
  StageTransition,
} from "@/features/editor/useStageClassification";
import { M2_CONFIDENCE_CUTOFF } from "@/lib/backend/config";
import type { TaskDefinitionAnalysis } from "@/features/task-definition/types";

const IS_DEV =
  (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env?.NODE_ENV !== "production";

const SAVE_STATUS_LABEL: Record<string, string> = {
  idle: "",
  saving: "Saving...",
  saved: "Saved",
  error: "Couldn't save -- retrying on next edit",
};

const FALLBACK_PRO_TIP =
  "Work through each milestone in order -- the guide panel adapts its suggestions as your draft grows.";
const TITLE_PREVIEW_LENGTH = 80;

interface WritingEditorProps {
  /**
   * Module 1's task breakdown. The wizard passes the one it just generated; every
   * other host leaves it out and gets the writer's last breakdown from session
   * storage instead. With neither, the editor still works -- it just has no
   * milestones or task-specific guidance to show alongside the manuscript.
   */
  readonly analysis?: TaskDefinitionAnalysis;
  readonly projectTitle?: string;
  readonly onStageChange?: (signal: StageClassificationSignal) => void;
}

function deriveTitle(question: string): string {
  const trimmed = question.trim();
  if (trimmed.length <= TITLE_PREVIEW_LENGTH) return trimmed;
  return `${trimmed.slice(0, TITLE_PREVIEW_LENGTH).trimEnd()}...`;
}

/**
 * The single manuscript surface. Rich text editing (Module 2's stage classification
 * and Module 3's feedback ride along on the same editor instance) plus the task
 * breakdown rails, which appear only when the caller has an analysis to show.
 */
export function WritingEditor(props: Readonly<WritingEditorProps>) {
  const { analysis: providedAnalysis, projectTitle = "", onStageChange } = props;

  const storedAnalysis = useStoredTaskAnalysis(providedAnalysis === undefined);
  const analysis = providedAnalysis ?? storedAnalysis;

  const milestones = analysis?.breakdown.milestones ?? [];
  const actions = analysis?.breakdown.actions;

  const [selectedMilestoneId, setSelectedMilestoneId] = useState("");
  // The stored breakdown lands an effect after mount, so the first milestone is
  // resolved at render rather than seeded into state -- which would have been
  // empty at the only moment it was read.
  const activeMilestoneId = selectedMilestoneId || (milestones[0]?.id ?? "");
  const [title, setTitle] = useState(() => deriveTitle(projectTitle));

  const { status: saveStatus, notifyChange } = useDraftAutosave();
  const { editor, keystrokeCount } = useManuscriptEditor({ onTextChange: notifyChange });

  const feedback = useFeedback();
  const { requestFeedback } = feedback;

  const handleStageTransition = useCallback(
    (transition: StageTransition) => {
      requestFeedback({
        sessionId: transition.sessionId,
        stage: transition.stage,
        content: transition.content,
      });
    },
    [requestFeedback],
  );

  const { scrollContainerRef } = useStageClassification(editor, {
    confidenceCutoff: M2_CONFIDENCE_CUTOFF,
    onStageChange,
    onStageTransition: handleStageTransition,
  });

  const editorState = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      words: instance?.storage.characterCount.words() ?? 0,
      characters: instance?.storage.characterCount.characters() ?? 0,
      isPainterArmed: instance ? getPainterState(instance.state) !== null : false,
    }),
  });

  const guideItems = useMemo(
    () =>
      [
        { category: "Organization", actions: actions?.organization ?? [] },
        { category: "Mechanics", actions: actions?.mechanics ?? [] },
      ].filter((item) => item.actions.length > 0),
    [actions],
  );

  const proTip = actions?.organization[0] ?? FALLBACK_PRO_TIP;

  return (
    // `min-h-0` lets this pane shrink inside the page's flex column, which is
    // what confines the overflow to the scroll container below rather than
    // pushing the status bar off-screen. `h-full` covers the other host: the
    // wizard drops the editor into a plain block, where `flex-1` means nothing.
    <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-surface">
      {milestones.length > 0 && (
        <MilestoneSidebar
          milestones={milestones}
          activeMilestoneId={activeMilestoneId}
          onSelect={setSelectedMilestoneId}
          proTip={proTip}
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-baseline justify-between gap-4 px-8 pt-5">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Project Title"
            aria-label="Project title"
            className="w-full border-none bg-transparent text-lg font-semibold text-foreground placeholder:text-foreground/40 focus:outline-none"
          />
          {saveStatus !== "idle" && (
            <span className="shrink-0 text-xs text-foreground/50" aria-live="polite">
              {SAVE_STATUS_LABEL[saveStatus]}
            </span>
          )}
        </div>

        {editor && <EditorToolbar editor={editor} />}

        <div
          ref={scrollContainerRef}
          className={clsx(
            "min-h-0 flex-1 overflow-y-auto px-8 py-6",
            // Signals that the next selection will be painted rather than just made.
            editorState?.isPainterArmed && "manuscript-painting",
          )}
        >
          <EditorContent editor={editor} className="h-full" />
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-border-subtle px-6 py-2 text-xs text-foreground/50">
          <div className="flex items-center gap-3">
            <span>{(editorState?.words ?? 0).toLocaleString()} words</span>
          </div>
          {IS_DEV && (
            <span title="Keyup events written to the console (development only)">
              {keystrokeCount.toLocaleString()} keyups logged
            </span>
          )}
          <span>{(editorState?.characters ?? 0).toLocaleString()} characters</span>
        </div>
      </div>

      <aside
        className="flex w-80 shrink-0 flex-col overflow-hidden border-l border-border-subtle bg-surface"
        aria-label="Writing support"
      >
        <FeedbackPanel
          status={feedback.status}
          pendingStage={feedback.pendingStage}
          history={feedback.history}
          error={feedback.error}
          onDismissError={feedback.dismissError}
        />

        {guideItems.length > 0 ? (
          <GuidePanel items={guideItems} />
        ) : (
          <p className="shrink-0 border-t border-border-subtle px-4 py-3 text-xs text-foreground/50">
            <Link href="/task-definition" className="font-medium text-brand hover:underline">
              Define a task
            </Link>{" "}
            to see its milestones and writing guidance here.
          </p>
        )}
      </aside>
    </div>
  );
}
