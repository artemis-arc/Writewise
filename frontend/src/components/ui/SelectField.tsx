import { forwardRef, useId } from "react";
import type { SelectHTMLAttributes } from "react";
import clsx from "clsx";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  icon?: React.ReactNode;
  options: readonly SelectOption[];
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, icon, options, className, id, ...props }, ref) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-2">
        <label
          htmlFor={fieldId}
          className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-brand uppercase"
        >
          {icon}
          {label}
        </label>
        <select
          ref={ref}
          id={fieldId}
          className={clsx(
            "w-full rounded-lg border border-border-subtle bg-surface px-4 py-3 text-sm text-foreground",
            "focus:outline-none focus:ring-2 focus:ring-brand",
            className,
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  },
);

SelectField.displayName = "SelectField";
