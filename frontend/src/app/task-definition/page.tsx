"use client";

import { useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { TaskForm } from "@/components/task-definition/TaskForm";
import { VocabularyStep } from "@/components/task-definition/VocabularyStep";
import { UploadStep } from "@/components/task-definition/UploadStep";
import { AnalysisSummary } from "@/components/task-definition/AnalysisSummary";
import { WritingEditor } from "@/components/editor/WritingEditor";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useTaskDefinitionAnalysis } from "@/features/task-definition/hooks/useTaskDefinitionAnalysis";
import type { TaskDefinitionFormValues } from "@/features/task-definition/schema";

export type TaskDefinitionStep = "tasks" | "vocabulary" | "upload" | "analysis" | "editor";

const STEP_ORDER: TaskDefinitionStep[] = ["tasks", "vocabulary", "upload", "analysis"];

export default function TaskDefinitionPage() {
  const [wizardStep, setWizardStep] = useState<TaskDefinitionStep>("tasks");
  const [formValues, setFormValues] = useState<TaskDefinitionFormValues | undefined>();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const { status, analysis, error, runAnalysis, reset } = useTaskDefinitionAnalysis();

  // The "analysis" step is reached whenever scoring succeeds, regardless of the wizard's
  // own step state -- deriving it here avoids syncing state via an effect. "editor" is an
  // explicit forward step past analysis, so it takes precedence once reached.
  const currentStep: TaskDefinitionStep =
    wizardStep === "editor" ? "editor" : status === "success" && analysis ? "analysis" : wizardStep;

  const handleTaskSubmit = (values: TaskDefinitionFormValues) => {
    setFormValues(values);
    setWizardStep("vocabulary");
  };

  const handleUploadNext = (file: File) => {
    setUploadedFile(file);
    if (formValues) {
      void runAnalysis(formValues, file);
    }
  };

  const handleModifyQuestion = () => {
    reset();
    setWizardStep("tasks");
  };

  const handleStartWriting = () => {
    setWizardStep("editor");
  };

  const handleRetry = () => {
    if (formValues && uploadedFile) {
      void runAnalysis(formValues, uploadedFile);
    }
  };

  const stepIndex = STEP_ORDER.indexOf(currentStep);
  const isEditorStep = currentStep === "editor";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar />

      {!isEditorStep && (
        <div className="shrink-0 px-6 py-4">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
            <span className="shrink-0 text-xs font-semibold tracking-wide text-brand">
              STEP {String(stepIndex + 1).padStart(2, "0")}
            </span>
            <ProgressBar
              compact
              label={`Step ${stepIndex + 1} of ${STEP_ORDER.length}`}
              value={((stepIndex + 1) / STEP_ORDER.length) * 100}
              trackClassName="bg-surface-muted"
              barClassName="bg-brand"
            />
          </div>
        </div>
      )}

      <div className={isEditorStep ? "flex-1 overflow-hidden" : "flex-1 overflow-y-auto"}>
        {status === "error" && (
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-6 py-16 text-center">
            <p className="font-medium text-red-500">{error}</p>
            <Button onClick={handleRetry}>Try Again</Button>
          </div>
        )}

        {status !== "error" && currentStep === "tasks" && (
          <TaskForm defaultValues={formValues} isSubmitting={false} onSubmit={handleTaskSubmit} />
        )}

        {status !== "error" && currentStep === "vocabulary" && (
          <VocabularyStep
            onNext={() => setWizardStep("upload")}
            onBack={() => setWizardStep("tasks")}
          />
        )}

        {status !== "error" && currentStep === "upload" && (
          <UploadStep
            isSubmitting={status === "loading"}
            onNext={handleUploadNext}
            onBack={() => setWizardStep("vocabulary")}
          />
        )}

        {status !== "error" && currentStep === "analysis" && analysis && (
          <AnalysisSummary
            analysis={analysis}
            onModifyQuestion={handleModifyQuestion}
            onStartWriting={handleStartWriting}
          />
        )}

        {currentStep === "editor" && analysis && (
          <WritingEditor analysis={analysis} projectTitle={formValues?.question ?? ""} />
        )}
      </div>
    </div>
  );
}
