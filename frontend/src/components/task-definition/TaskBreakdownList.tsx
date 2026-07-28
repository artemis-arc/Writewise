import type { TaskMilestone } from "@/features/task-definition/types";

interface TaskBreakdownListProps {
  milestones: TaskMilestone[];
}

export function TaskBreakdownList({ milestones }: TaskBreakdownListProps) {
  return (
    <ol className="flex flex-col">
      {milestones.map((milestone, index) => {
        const isLast = index === milestones.length - 1;
        return (
          <li key={milestone.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-foreground">
                {milestone.order}
              </span>
              {!isLast && <span className="w-px flex-1 bg-border-subtle" aria-hidden="true" />}
            </div>
            <div className={isLast ? "pb-0" : "pb-6"}>
              <h3 className="font-semibold text-foreground">{milestone.title}</h3>
              <p className="mt-1 text-sm text-foreground/60">{milestone.description}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
