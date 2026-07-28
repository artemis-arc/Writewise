import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TaskBreakdownList } from "@/components/task-definition/TaskBreakdownList";
import { WritingProfileCard } from "@/components/task-definition/WritingProfileCard";
import { StepHeader } from "@/components/task-definition/StepHeader";
import type { TaskDefinitionAnalysis } from "@/features/task-definition/types";

interface AnalysisSummaryProps {
  analysis: TaskDefinitionAnalysis;
  onModifyQuestion: () => void;
  onStartWriting: () => void;
}

export function AnalysisSummary({ analysis, onModifyQuestion, onStartWriting }: AnalysisSummaryProps) {
  const { breakdown, writingProfile } = analysis;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <StepHeader
        title="Analysis Summary."
        description="Review your document's structural breakdown and performance metrics."
      />

      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-start">
        <Card>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              Task Breakdown
            </h2>
            <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-brand">
              {breakdown.milestones.length} Key Milestones
            </span>
          </div>
          <TaskBreakdownList milestones={breakdown.milestones} />
        </Card>

        <div className="flex flex-col gap-4">
          <WritingProfileCard profile={writingProfile} />

          <Button variant="secondary" onClick={onModifyQuestion} className="w-full">
            Modify Question
          </Button>
          <Button variant="primary" className="w-full" onClick={onStartWriting}>
            Start Writing
          </Button>
        </div>
      </div>
    </div>
  );
}
