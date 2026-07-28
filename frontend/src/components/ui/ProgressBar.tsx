interface ProgressBarProps {
  label: string;
  value: number;
  trackClassName?: string;
  barClassName?: string;
  /** Hides the label/percentage text and renders just the slim track+bar. */
  compact?: boolean;
}

export function ProgressBar({
  label,
  value,
  trackClassName = "bg-white/20",
  barClassName = "bg-white",
  compact = false,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  const track = (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-1.5 w-full overflow-hidden rounded-full ${trackClassName}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${barClassName}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );

  if (compact) {
    return track;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs font-semibold tracking-wide uppercase">
        <span>{label}</span>
      </div>
      {track}
      <span className="self-end text-xs font-medium">{clamped}%</span>
    </div>
  );
}
