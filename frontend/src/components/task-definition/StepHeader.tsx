interface StepHeaderProps {
  title: string;
  description: string;
}

/** Consistent title/subtitle block shared by every step in the task-definition wizard. */
export function StepHeader({ title, description }: StepHeaderProps) {
  return (
    <div className="flex flex-col gap-2 text-center">
      <h1 className="text-2xl font-bold text-brand">{title}</h1>
      <p className="text-sm text-foreground/60">{description}</p>
    </div>
  );
}
