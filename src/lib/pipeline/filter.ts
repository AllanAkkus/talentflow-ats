import { PIPELINE_STAGES } from "@/lib/constants";
import type { BoardApplication } from "@/lib/data/ats";
import type { PipelineStage } from "@/types/database";

/**
 * Pure pipeline filtering and grouping.
 *
 * Kept free of React and Supabase so it is unit-testable and so the Kanban can
 * re-filter in the browser on every keystroke without a server round-trip.
 * Tenant scoping is NOT done here - the rows handed in have already been
 * restricted to one organization by the query and by RLS.
 */

export const ALL_JOBS = "all" as const;

export type PipelineFilters = {
  /** A job id, or ALL_JOBS. */
  jobId: string | typeof ALL_JOBS;
  /** Case-insensitive partial candidate-name match. */
  query: string;
  showRejected: boolean;
};

export const DEFAULT_FILTERS: PipelineFilters = {
  jobId: ALL_JOBS,
  query: "",
  showRejected: false,
};

export function filterApplications(
  applications: readonly BoardApplication[],
  filters: PipelineFilters,
): BoardApplication[] {
  const term = filters.query.trim().toLowerCase();

  return applications.filter((application) => {
    if (filters.jobId !== ALL_JOBS && application.job.id !== filters.jobId) {
      return false;
    }

    if (!filters.showRejected && application.stage === "rejected") {
      return false;
    }

    if (term && !application.candidate.full_name.toLowerCase().includes(term)) {
      return false;
    }

    return true;
  });
}

export function groupByStage(
  applications: readonly BoardApplication[],
): Record<PipelineStage, BoardApplication[]> {
  const groups = Object.fromEntries(
    PIPELINE_STAGES.map((stage) => [stage, [] as BoardApplication[]]),
  ) as Record<PipelineStage, BoardApplication[]>;

  for (const application of applications) {
    groups[application.stage].push(application);
  }

  return groups;
}
