import clsx from "clsx";
import { InfoIcon } from "@/components/ui/icons";
import type { TaskMilestone } from "@/features/task-definition/types";

interface MilestoneSidebarProps {
  milestones: TaskMilestone[];
  activeMilestoneId: string;
  onSelect: (id: string) => void;
  proTip: string;
}

export function MilestoneSidebar({
  milestones,
  activeMilestoneId,
  onSelect,
  proTip,
}: MilestoneSidebarProps) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col gap-4 border-r border-border-subtle bg-surface-muted p-4">
      <span className="px-2 text-xs font-semibold tracking-wide text-brand uppercase">
        Task Breakdown
      </span>

      <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
        {milestones.map((milestone) => {
          const isActive = milestone.id === activeMilestoneId;
          return (
            <button
              key={milestone.id}
              type="button"
              onClick={() => onSelect(milestone.id)}
              aria-current={isActive ? "true" : undefined}
              className={clsx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                isActive
                  ? "bg-brand text-brand-foreground"
                  : "text-foreground/70 hover:bg-surface",
              )}
            >
              <span
                className={clsx(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  isActive ? "bg-brand-foreground/20" : "bg-surface text-brand",
                )}
              >
                {milestone.order}
              </span>
              <span className="truncate">{milestone.title}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2 rounded-xl bg-surface p-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-brand">
          <InfoIcon className="h-3.5 w-3.5" />
          Pro Tip
        </span>
        <p className="text-xs italic text-foreground/60">{proTip}</p>
      </div>
    </aside>
  );
}
