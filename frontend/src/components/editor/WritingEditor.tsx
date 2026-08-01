"use client";

import { useMemo, useState } from "react";
import { MilestoneSidebar } from "@/components/editor/MilestoneSidebar";
import { GuidePanel } from "@/components/editor/GuidePanel";
import { useDraftAutosave } from "@/features/editor/hooks/useDraftAutosave";
import type { TaskDefinitionAnalysis } from "@/features/task-definition/types";

const SAVE_STATUS_LABEL: Record<string, string> = {
  idle: "",
  saving: "Saving...",
  saved: "Saved",
  error: "Couldn't save -- retrying on next edit",
};

interface WritingEditorProps {
  analysis: TaskDefinitionAnalysis;
  projectTitle: string;
}

const FALLBACK_PRO_TIP =
  "Work through each milestone in order -- the guide panel adapts its suggestions as your draft grows.";
const TITLE_PREVIEW_LENGTH = 80;

function deriveTitle(question: string): string {
  const trimmed = question.trim();
  if (trimmed.length <= TITLE_PREVIEW_LENGTH) return trimmed;
  return `${trimmed.slice(0, TITLE_PREVIEW_LENGTH).trimEnd()}...`;
}

export function WritingEditor({ analysis, projectTitle }: WritingEditorProps) {
  const { milestones, actions } = analysis.breakdown;
  const [activeMilestoneId, setActiveMilestoneId] = useState(milestones[0]?.id ?? "");
  const [title, setTitle] = useState(() => deriveTitle(projectTitle));
  const [draft, setDraft] = useState("");
  const { status: saveStatus, notifyChange } = useDraftAutosave();

  function handleDraftChange(value: string) {
    setDraft(value);
    notifyChange(value);
  }

  const guideItems = useMemo(
    () =>
      [
        { category: "Organization", actions: actions.organization },
        { category: "Mechanics", actions: actions.mechanics },
      ].filter((item) => item.actions.length > 0),
    [actions],
  );

  const proTip = actions.organization[0] ?? FALLBACK_PRO_TIP;

  return (
    <div className="flex h-full">
      <MilestoneSidebar
        milestones={milestones}
        activeMilestoneId={activeMilestoneId}
        onSelect={setActiveMilestoneId}
        proTip={proTip}
      />

      <div className="flex flex-1 flex-col overflow-y-auto px-10 py-8">
        <div className="flex items-baseline justify-between gap-4">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Project Title"
            className="w-full border-none bg-transparent text-lg font-semibold text-foreground placeholder:text-foreground/40 focus:outline-none"
          />
          {saveStatus !== "idle" && (
            <span
              className="shrink-0 text-xs text-foreground/50"
              aria-live="polite"
            >
              {SAVE_STATUS_LABEL[saveStatus]}
            </span>
          )}
        </div>
        <textarea
          value={draft}
          onChange={(event) => handleDraftChange(event.target.value)}
          placeholder="Begin your intellectual exploration here..."
          className="mt-4 w-full flex-1 resize-none border-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-foreground/40 focus:outline-none"
        />
      </div>

      <GuidePanel items={guideItems} />
    </div>
  );
}
