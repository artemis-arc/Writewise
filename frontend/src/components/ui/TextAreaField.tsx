import { forwardRef, useId } from "react";
import type { TextareaHTMLAttributes } from "react";
import clsx from "clsx";

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
  maxLength?: number;
  currentLength?: number;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  (
    { label, hint, error, maxLength, currentLength, className, id, ...props },
    ref,
  ) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const hintId = `${fieldId}-hint`;
    const errorId = `${fieldId}-error`;

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <label
            htmlFor={fieldId}
            className="text-xs font-semibold tracking-wide text-brand uppercase"
          >
            {label}
          </label>
          {typeof maxLength === "number" && (
            <span className="text-xs text-foreground/50">
              {currentLength ?? 0} / {maxLength}
            </span>
          )}
        </div>
        <textarea
          ref={ref}
          id={fieldId}
          maxLength={maxLength}
          aria-invalid={Boolean(error)}
          aria-describedby={clsx(hint && hintId, error && errorId) || undefined}
          className={clsx(
            "min-h-40 w-full resize-y rounded-xl border bg-surface-muted p-4 text-sm text-foreground",
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

TextAreaField.displayName = "TextAreaField";
