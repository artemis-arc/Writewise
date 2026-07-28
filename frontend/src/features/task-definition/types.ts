export type AcademicLevel =
  | "foundation"
  | "undergraduate"
  | "postgraduate"
  | "doctoral";

export type CitationStyle = "APA7" | "MLA" | "Chicago" | "Harvard";

export interface TaskDefinitionInput {
  question: string;
  academicLevel: AcademicLevel;
  citationStyle: CitationStyle;
}

/**
 * Mirrors the {mechanics, vocabulary, organization} scores SRSD_content_scoring.ipynb
 * will eventually produce from a writer's previous samples, plus a derived overall score.
 */
export interface WritingProfile {
  vocabulary: number;
  mechanics: number;
  organization: number;
  overall: number;
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
    vocabulary: string[];
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
