import type { MouseEvent, ReactNode } from "react";
import clsx from "clsx";

interface ToolbarButtonProps {
  label: string;
  /** Receives the event so callers can read `detail` to tell clicks from double-clicks. */
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Omit for one-shot commands (undo/redo) so they are not announced as toggles. */
  isActive?: boolean;
  isDisabled?: boolean;
  children: ReactNode;
}

export function ToolbarButton({
  label,
  onClick,
  isActive,
  isDisabled,
  children,
}: Readonly<ToolbarButtonProps>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      title={label}
      aria-label={label}
      aria-pressed={isActive}
      className={clsx(
        "flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-bold transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:cursor-not-allowed disabled:opacity-40",
        isActive ? "bg-brand text-brand-foreground" : "text-foreground/60 hover:bg-surface-muted",
      )}
    >
      {children}
    </button>
  );
}

export function ToolbarDivider() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border-subtle" />;
}

interface ToolbarSelectOption {
  value: string;
  label: string;
}

interface ToolbarSelectProps {
  label: string;
  value: string;
  options: readonly ToolbarSelectOption[];
  onChange: (value: string) => void;
  /** Render each option in the font it names, the way Word and Google Docs do. */
  previewOptionFont?: boolean;
  className?: string;
}

export function ToolbarSelect({
  label,
  value,
  options,
  onChange,
  previewOptionFont,
  className,
}: Readonly<ToolbarSelectProps>) {
  return (
    <select
      title={label}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={clsx(
        "h-8 rounded-lg border border-border-subtle bg-surface px-2 text-xs text-foreground transition-colors",
        "hover:bg-surface-muted",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        className,
      )}
    >
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
          style={previewOptionFont && option.value ? { fontFamily: option.value } : undefined}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
}
