import { useState } from "react";
import { ChevronDownIcon, SparkleIcon } from "@/components/ui/icons";

interface GuideItem {
  category: string;
  actions: string[];
}

interface GuidePanelProps {
  items: GuideItem[];
}

export function GuidePanel({ items }: GuidePanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="fixed bottom-6 right-6 z-10 w-80 max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl bg-brand text-brand-foreground shadow-lg">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold"
      >
        <span className="flex items-center gap-2">
          <SparkleIcon className="h-4 w-4" />
          Write Wise Guide
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "" : "-rotate-180"}`}
        />
      </button>

      {isOpen && (
        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto px-4 pb-4">
          {items.map((item) => (
            <div key={item.category} className="rounded-xl bg-white/10 p-3">
              <p className="text-xs font-semibold tracking-wide uppercase">{item.category}</p>
              <ul className="mt-1 flex flex-col gap-1 text-sm text-brand-foreground/80">
                {item.actions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
