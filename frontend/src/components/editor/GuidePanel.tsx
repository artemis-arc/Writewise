"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronDownIcon, SparkleIcon } from "@/components/ui/icons";

interface GuideItem {
  category: string;
  actions: string[];
}

interface GuidePanelProps {
  readonly items: readonly GuideItem[];
}

/**
 * Module 1's task-specific actions, as a section of the editor's right rail
 * beneath the live feedback.
 */
export function GuidePanel({ items }: Readonly<GuidePanelProps>) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <section className={clsx("flex min-h-0 flex-col border-t border-border-subtle", isOpen && "flex-1")}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex shrink-0 items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-foreground"
      >
        <span className="flex items-center gap-2">
          <SparkleIcon className="h-4 w-4 text-brand" />
          Write Wise Guide
        </span>
        <ChevronDownIcon
          className={clsx("h-4 w-4 shrink-0 transition-transform", isOpen ? "" : "-rotate-90")}
        />
      </button>

      {isOpen && (
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto px-4 pb-4">
          {items.map((item) => (
            <div key={item.category} className="rounded-xl bg-surface-muted p-3">
              <p className="text-xs font-semibold tracking-wide text-brand uppercase">
                {item.category}
              </p>
              <ul className="mt-1 flex flex-col gap-1 text-sm text-foreground/75">
                {item.actions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
