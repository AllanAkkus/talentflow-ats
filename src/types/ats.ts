import type { Candidate, Job, PipelineStage } from "@/types/database";

/**
 * Shapes returned by the read model in `lib/data/ats.ts`.
 *
 * They live here, not in that module, because client components need them.
 * `lib/data/ats.ts` imports "server-only", and while a type-only import is
 * erased at compile time, keeping the types in a neutral module means the
 * boundary is obvious from the import graph instead of depending on whether
 * someone remembered to write `import type`.
 */

export type JobWithCount = Job & { applicationCount: number };

export type CandidateWithCount = Candidate & { applicationCount: number };

export type BoardCandidate = Pick<
  Candidate,
  "id" | "full_name" | "email" | "linkedin_url" | "location"
> & {
  /**
   * Whether there is CV text to analyse. Derived rather than selected so the
   * board never ships 60kB of CV per card to the browser. If the talent pool
   * ever got large this would become a generated column in Postgres.
   */
  hasCvText: boolean;
};

export type BoardApplication = {
  id: string;
  stage: PipelineStage;
  notes: string | null;
  createdAt: string;
  candidate: BoardCandidate;
  job: Pick<Job, "id" | "title">;
};

export type DashboardStats = {
  openJobs: number;
  totalJobs: number;
  candidates: number;
  byStage: Record<PipelineStage, number>;
};
