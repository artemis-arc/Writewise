import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/Button";

interface ColorPickerProps {
  editor: Editor;
  /** The selection's current text color, or "" when it has none. */
  value: string;
}

const PRESET_COLORS = [
  { value: "#00345c", label: "Navy" },
  { value: "#1f2937", label: "Charcoal" },
  { value: "#b91c1c", label: "Crimson" },
  { value: "#b45309", label: "Amber" },
  { value: "#15803d", label: "Forest" },
  { value: "#1d4ed8", label: "Blue" },
  { value: "#6d28d9", label: "Violet" },
  { value: "#be185d", label: "Magenta" },
] as const;

// `input[type=color]` has no concept of "unset", so it needs something concrete
// to show when the selection carries no color of its own.
const FALLBACK_SWATCH = "#00345c";

export function ColorPicker({ editor, value }: Readonly<ColorPickerProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const applyColor = (color: string) => {
    editor.chain().focus().setColor(color).run();
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        title="Text color"
        aria-label="Text color"
        aria-expanded={isOpen}
        className={clsx(
          "flex h-8 min-w-8 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs font-bold transition-colors",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
          isOpen ? "bg-surface-muted text-foreground" : "text-foreground/60 hover:bg-surface-muted",
        )}
      >
        <span aria-hidden="true" className="leading-none">
          A
        </span>
        <span
          aria-hidden="true"
          className="h-1 w-4 rounded-full"
          style={{ background: value || "currentColor" }}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 z-20 mt-1 flex w-56 flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-3 shadow-lg">
          <div className="grid grid-cols-4 gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                title={color.label}
                aria-label={color.label}
                aria-pressed={value === color.value}
                onClick={() => applyColor(color.value)}
                style={{ background: color.value }}
                className={clsx(
                  "h-7 w-full rounded-md border transition-transform hover:scale-105",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  value === color.value ? "border-brand ring-2 ring-brand" : "border-border-subtle",
                )}
              />
            ))}
          </div>

          <label className="flex items-center justify-between gap-2 text-xs text-foreground/70">
            Custom
            <input
              type="color"
              value={value || FALLBACK_SWATCH}
              onChange={(event) => applyColor(event.target.value)}
              className="h-7 w-12 cursor-pointer rounded-md border border-border-subtle bg-surface p-0.5"
            />
          </label>

          <Button
            type="button"
            variant="secondary"
            className="px-4 py-1.5 text-xs"
            onClick={() => {
              editor.chain().focus().unsetColor().run();
              setIsOpen(false);
            }}
          >
            Remove color
          </Button>
        </div>
      )}
    </div>
  );
}
