"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { SelectField } from "@/components/ui/SelectField";
import { ChipRadioGroup } from "@/components/ui/ChipRadioGroup";
import { ArrowRightIcon } from "@/components/ui/icons";
import { StepHeader } from "@/components/task-definition/StepHeader";
import {
  academicLevels,
  citationStyles,
  taskDefinitionSchema,
  type TaskDefinitionFormValues,
} from "@/features/task-definition/schema";

const QUESTION_MAX_LENGTH = 2000;

interface TaskFormProps {
  defaultValues?: Partial<TaskDefinitionFormValues>;
  isSubmitting: boolean;
  onSubmit: (values: TaskDefinitionFormValues) => void;
}

export function TaskForm({ defaultValues, isSubmitting, onSubmit }: TaskFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<TaskDefinitionFormValues>({
    resolver: zodResolver(taskDefinitionSchema),
    defaultValues: {
      question: "",
      academicLevel: "undergraduate",
      citationStyle: "APA7",
      ...defaultValues,
    },
  });

  const questionValue = watch("question");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8">
      <StepHeader
        title="Define Your Task."
        description="Provide the details of your research question or academic assignment."
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card className="flex flex-col gap-6">
          <TextAreaField
            label="Research question or task"
            placeholder="e.g., 'Analyze the impact of late-stage capitalism on urban development patterns in Southeast Asia...'"
            hint="Minimum 50 words recommended for best results"
            maxLength={QUESTION_MAX_LENGTH}
            currentLength={questionValue?.length ?? 0}
            error={errors.question?.message}
            {...register("question")}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Academic level"
              options={academicLevels}
              {...register("academicLevel")}
            />

            <Controller
              control={control}
              name="citationStyle"
              render={({ field }) => (
                <ChipRadioGroup
                  label="Citation style"
                  name={field.name}
                  options={citationStyles}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" isLoading={isSubmitting}>
              {isSubmitting ? "Analyzing..." : "Next Step"}
              {!isSubmitting && <ArrowRightIcon className="h-4 w-4" />}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
