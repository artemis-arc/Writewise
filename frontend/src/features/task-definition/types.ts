export type AcademicLevel =
  | "foundation"
  | "undergraduate"
  | "postgraduate"
  | "doctoral";

export type CitationStyle = "APA7" | "MLA" | "Chicago" | "Harvard" | "IEEE";

export interface TaskDefinitionInput {
  question: string;
  academicLevel: AcademicLevel;
  citationStyle: CitationStyle;
}

/**
 * Mirrors the {mechanics, organization} scores SRSD_content_scoring.ipynb produces from
 * a writer's previous samples, plus a derived overall score. Vocabulary is deferred to
 * future work and intentionally not scored.
 */
export interface WritingProfile {
  mechanics: number;
  organization: number;
  overall: number;
  submissionId?: string | null;
}

export interface TaskMilestone {
  id: string;
  order: number;
  title: string;
  description: string;
  completed: boolean;
}

/** Shape produced by task_define.ipynb's RAG + Gemini prompt ("Task Breakdown" + "Specific Actions"). */
export interface TaskBreakdown {
  milestones: TaskMilestone[];
  actions: {
    mechanics: string[];
    organization: string[];
  };
}

export interface SubmitTaskResult {
  taskId: string;
}

export interface TaskDefinitionAnalysis {
  taskId: string;
  writingProfile: WritingProfile;
  breakdown: TaskBreakdown;
}
