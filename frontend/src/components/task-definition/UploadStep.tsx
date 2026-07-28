"use client";

import { useId, useRef, useState } from "react";
import clsx from "clsx";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CloudUploadIcon,
  FileIcon,
} from "@/components/ui/icons";
import { StepHeader } from "@/components/task-definition/StepHeader";

const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ACCEPTED_EXTENSIONS = [".pdf", ".docx"];
const MAX_SIZE_BYTES = 25 * 1024 * 1024;

interface UploadStepProps {
  isSubmitting: boolean;
  onNext: (file: File) => void;
  onBack: () => void;
}

function isAcceptedFile(file: File): boolean {
  const hasAcceptedExtension = ACCEPTED_EXTENSIONS.some((ext) =>
    file.name.toLowerCase().endsWith(ext),
  );
  return ACCEPTED_MIME_TYPES.includes(file.type) || hasAcceptedExtension;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function UploadStep({ isSubmitting, onNext, onBack }: UploadStepProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const handleFile = (candidate: File | undefined) => {
    if (!candidate) return;

    if (!isAcceptedFile(candidate)) {
      setError("Only PDF and DOCX files are supported.");
      setFile(null);
      return;
    }
    if (candidate.size > MAX_SIZE_BYTES) {
      setError("File exceeds the 25MB limit.");
      setFile(null);
      return;
    }

    setError(null);
    setFile(candidate);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <StepHeader
        title="Upload your intellect."
        description="Submit your previous essays, research papers, or creative drafts."
      />

      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <Card className="flex flex-col items-center justify-center gap-4 text-center">
          <label
            htmlFor={inputId}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              handleFile(event.dataTransfer.files?.[0]);
            }}
            className={clsx(
              "flex w-full cursor-pointer flex-col items-center gap-4 rounded-xl border-2 border-dashed px-6 py-12 transition-colors",
              isDragging ? "border-brand bg-surface-muted" : "border-border-subtle",
            )}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-brand">
              <CloudUploadIcon className="h-6 w-6" />
            </span>
            <span className="font-semibold text-foreground">Drag and drop your manuscript</span>
            <span className="text-xs text-foreground/50">
              Support for PDF and DOCX files up to 25MB.
            </span>
            <span className={clsx("pointer-events-none", "inline-block")}>
              <Button type="button" variant="primary" className="pointer-events-none">
                Browse Files
              </Button>
            </span>
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept=".pdf,.docx"
              className="sr-only"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
          </label>

          {error && (
            <p role="alert" className="text-sm font-medium text-red-500">
              {error}
            </p>
          )}

          {file && !error && (
            <div className="flex w-full items-center gap-3 rounded-xl border border-border-subtle bg-surface-muted px-4 py-3 text-left">
              <FileIcon className="h-5 w-5 shrink-0 text-brand" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-foreground/50">{formatFileSize(file.size)}</p>
              </div>
              <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand" />
            </div>
          )}
        </Card>

        <Card className="flex flex-col gap-4">
          <span className="text-xs font-semibold tracking-wide text-brand uppercase">
            Submission Criteria
          </span>
          <div className="flex flex-col gap-3 text-sm">
            <div className="border-l-2 border-brand pl-3">
              <p className="font-semibold text-foreground">Original Content</p>
              <p className="text-foreground/60">Ensure the document is your own intellectual property.</p>
            </div>
            <div className="border-l-2 border-brand pl-3">
              <p className="font-semibold text-foreground">Clear Structure</p>
              <p className="text-foreground/60">
                Use clear headings to help scoring understand your narrative flow.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="secondary" onClick={onBack} disabled={isSubmitting}>
          Back
        </Button>
        <Button
          type="button"
          isLoading={isSubmitting}
          disabled={!file || Boolean(error)}
          onClick={() => file && onNext(file)}
        >
          {isSubmitting ? "Analyzing..." : "Next Step"}
          {!isSubmitting && <ArrowRightIcon className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
