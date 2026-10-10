/** Shared between the AI route handler and the client panel that renders it. */
export type AiAnalysisResult = {
  match_score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  suggested_interview_questions: string[];
};

export type AnalyzeCandidateResponse = {
  analysis: AiAnalysisResult;
  model: string | null;
  generatedAt: string;
};

export const AI_DISCLAIMER =
  "AI-generated decision support. Final hiring decisions should be made by a human.";
