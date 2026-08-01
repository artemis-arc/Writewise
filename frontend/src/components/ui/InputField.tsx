import { forwardRef, useId } from "react";
import type { InputHTMLAttributes } from "react";
import clsx from "clsx";

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, hint, error, className, id, ...props }, ref) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const hintId = `${fieldId}-hint`;
    const errorId = `${fieldId}-error`;

    return (
      <div className="flex flex-col gap-2">
        <label
          htmlFor={fieldId}
          className="text-xs font-semibold tracking-wide text-brand uppercase"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={Boolean(error)}
          aria-describedby={clsx(hint && hintId, error && errorId) || undefined}
          className={clsx(
            "w-full rounded-xl border bg-surface-muted p-3 text-sm text-foreground",
            "placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-brand",
            error ? "border-red-400" : "border-border-subtle",
            className,
          )}
          {...props}
        />
        {hint && !error && (
          <p id={hintId} className="text-xs text-foreground/50">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-xs font-medium text-red-500">
            {error}
          </p>
        )}
      </div>
    );
  },
);

InputField.displayName = "InputField";
