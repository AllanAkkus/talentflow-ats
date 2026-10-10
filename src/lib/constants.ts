import type { EmploymentType, JobStatus, PipelineStage } from "@/types/database";

/** Cookie that remembers which organization a platform admin is operating as. */
export const ACTIVE_ORG_COOKIE = "tf_active_org";

export const PIPELINE_STAGES: readonly PipelineStage[] = [
  "new",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
] as const;

/** Columns rendered on the Kanban board. `rejected` is a filter, not a column. */
export const BOARD_STAGES: readonly PipelineStage[] = [
  "new",
  "screening",
  "interview",
  "offer",
  "hired",
] as const;

export const STAGE_LABELS: Record<PipelineStage, string> = {
  new: "New",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
};

/** Tailwind classes per stage, used for column headers and card accents. */
export const STAGE_STYLES: Record<
  PipelineStage,
  { dot: string; badge: string; bar: string }
> = {
  new: {
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-700 ring-slate-200",
    bar: "bg-slate-400",
  },
  screening: {
    dot: "bg-sky-500",
    badge: "bg-sky-50 text-sky-700 ring-sky-200",
    bar: "bg-sky-500",
  },
  interview: {
    dot: "bg-violet-500",
    badge: "bg-violet-50 text-violet-700 ring-violet-200",
    bar: "bg-violet-500",
  },
  offer: {
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    bar: "bg-amber-500",
  },
  hired: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    bar: "bg-emerald-500",
  },
  rejected: {
    dot: "bg-rose-500",
    badge: "bg-rose-50 text-rose-700 ring-rose-200",
    bar: "bg-rose-500",
  },
};

export const JOB_STATUSES: readonly JobStatus[] = ["draft", "open", "closed"] as const;

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: "Draft",
  open: "Open",
  closed: "Closed",
};

export const JOB_STATUS_STYLES: Record<JobStatus, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  open: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  closed: "bg-rose-50 text-rose-700 ring-rose-200",
};

export const EMPLOYMENT_TYPES: readonly EmploymentType[] = [
  "full_time",
  "part_time",
  "contract",
  "internship",
  "temporary",
] as const;

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
  temporary: "Temporary",
};
