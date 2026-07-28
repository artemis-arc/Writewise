import clsx from "clsx";

interface ChipOption {
  value: string;
  label: string;
}

interface ChipRadioGroupProps {
  label: string;
  icon?: React.ReactNode;
  name: string;
  options: readonly ChipOption[];
  value: string;
  onChange: (value: string) => void;
}

export function ChipRadioGroup({
  label,
  icon,
  name,
  options,
  value,
  onChange,
}: ChipRadioGroupProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-brand uppercase">
        {icon}
        {label}
      </span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={clsx(
                "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                selected
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-border-subtle bg-surface text-foreground hover:bg-surface-muted",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
