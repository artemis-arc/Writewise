import { Card } from "@/components/ui/Card";
import type { SubmissionSummary } from "@/features/history/types";

interface SubmissionListProps {
  submissions: SubmissionSummary[];
}

const SOURCE_LABEL: Record<string, string> = {
  writing_profile_upload: "Uploaded manuscript",
  editor_draft: "Editor draft",
};

export function SubmissionList({ submissions }: SubmissionListProps) {
  if (submissions.length === 0) {
    return <p className="text-sm text-foreground/60">No past writings yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {submissions.map((submission) => (
        <Card key={submission.id} className="flex flex-col gap-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-brand">
              {SOURCE_LABEL[submission.source] ?? submission.source}
            </span>
            <span className="text-xs text-foreground/50">
              {new Date(submission.updatedAt).toLocaleString()}
            </span>
          </div>
          {submission.originalFilename && (
            <p className="text-sm font-medium text-foreground">{submission.originalFilename}</p>
          )}
          <p className="text-sm text-foreground/70">{submission.excerpt}</p>
          {submission.latestOverallScore !== null && (
            <p className="text-xs text-foreground/50">
              Overall score: <span className="font-semibold text-foreground">{submission.latestOverallScore.toFixed(0)}</span>
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}
