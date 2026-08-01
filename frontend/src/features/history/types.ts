export interface ScoreHistoryEntry {
  id: string;
  submissionId: string;
  mechanics: number;
  organization: number;
  overall: number;
  scoredAt: string;
  source: string;
  originalFilename: string | null;
  task: string | null;
}

export interface SubmissionSummary {
  id: string;
  source: string;
  originalFilename: string | null;
  excerpt: string;
  createdAt: string;
  updatedAt: string;
  latestOverallScore: number | null;
}
