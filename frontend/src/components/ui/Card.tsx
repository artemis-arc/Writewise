import type { HTMLAttributes } from "react";
import clsx from "clsx";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
