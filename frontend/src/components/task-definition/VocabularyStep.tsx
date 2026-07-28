"use client";

import { useState } from "react";
import clsx from "clsx";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon, BookIcon, BookOpenIcon, GraduationCapIcon, InfoIcon, StarIcon } from "@/components/ui/icons";
import { StepHeader } from "@/components/task-definition/StepHeader";

type Familiarity = "very" | "somewhat" | "slightly" | "new";

const familiarityOptions: { value: Familiarity; label: string; icon: typeof StarIcon }[] = [
  { value: "very", label: "Very familiar", icon: StarIcon },
  { value: "somewhat", label: "Somewhat familiar", icon: BookOpenIcon },
  { value: "slightly", label: "Slightly familiar", icon: BookIcon },
  { value: "new", label: "New to me", icon: GraduationCapIcon },
];

const exampleTags = ["#taxonomy", "#terminology", "#academic_lexicon"];

interface VocabularyStepProps {
  onNext: () => void;
  onBack: () => void;
}

/**
 * Collects a lightweight self-assessment of topic familiarity. Nothing here is sent to
 * an API or used by scoring/breakdown generation yet -- purely local UI state for now.
 */
export function VocabularyStep({ onNext, onBack }: VocabularyStepProps) {
  const [familiarity, setFamiliarity] = useState<Familiarity>("very");
  const [keywords, setKeywords] = useState("");
  const [academicContext, setAcademicContext] = useState("");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8">
      <StepHeader
        title="Vocabulary Check"
        description="Help us understand your current grasp of the topic terminology."
      />

      <Card className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold tracking-wide text-brand uppercase">
            How familiar are you with this topic?
          </span>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {familiarityOptions.map((option) => {
              const selected = option.value === familiarity;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFamiliarity(option.value)}
                  aria-pressed={selected}
                  className={clsx(
                    "flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-center text-xs font-medium transition-colors",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                    selected
                      ? "border-brand bg-surface-muted text-brand"
                      : "border-border-subtle bg-surface text-foreground/70 hover:bg-surface-muted",
                  )}
                >
                  <option.icon className="h-5 w-5" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-brand uppercase">
              Topic Keywords
            </span>
            <span className="flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-foreground/60">
              <InfoIcon className="h-3.5 w-3.5" />
              Only 8-10 words needed for a lightweight indicator
            </span>
          </div>
          <p className="text-xs text-foreground/50">Write 8-10 words or phrases related to this topic.</p>
          <textarea
            value={keywords}
            onChange={(event) => setKeywords(event.target.value)}
            placeholder="e.g., renewable energy, carbon emissions, sustainable infrastructure, energy transition..."
            className="min-h-24 w-full resize-y rounded-xl border border-border-subtle bg-surface-muted p-4 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <div className="flex flex-wrap gap-2">
            {exampleTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-surface-muted px-3 py-1 text-xs text-foreground/50"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-wide text-brand uppercase">
            Academic Context
          </span>
          <p className="text-xs text-foreground/50">
            Write one sentence about the topic using academic language.
          </p>
          <input
            type="text"
            value={academicContext}
            onChange={(event) => setAcademicContext(event.target.value)}
            placeholder="e.g., Renewable energy sources are essential for reducing long-term environmental damage."
            className="w-full rounded-lg border border-border-subtle bg-surface-muted px-4 py-3 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <div className="flex justify-between">
          <Button type="button" variant="secondary" onClick={onBack}>
            Back
          </Button>
          <Button type="button" onClick={onNext}>
            Next Step
            <ArrowRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
