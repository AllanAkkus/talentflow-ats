import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  Application,
  Candidate,
  CandidateAssessment,
  Job,
  PipelineStage,
} from "@/types/database";

/**
 * Read model for the ATS.
 *
 * Every function takes an explicit `organizationId` and filters on it. That
 * filter is for correctness and query planning - the actual security guarantee
 * comes from the RLS policies, which apply the same restriction inside Postgres
 * even if a call site here forgot to.
 *
 * Reads that need data from two tables run as two or three bulk queries and are
 * joined in memory rather than using PostgREST embedding. At MVP scale this is
 * a handful of indexed lookups, it keeps the hand-written Database types
 * accurate, and it avoids ambiguity from the composite foreign keys. Noted as a
 * deliberate trade-off in README.md.
 */

export type JobWithCount = Job & { applicationCount: number };

export type CandidateWithCount = Candidate & { applicationCount: number };

export type BoardApplication = {
  id: string;
  stage: PipelineStage;
  notes: string | null;
  createdAt: string;
  candidate: Pick<
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
  job: Pick<Job, "id" | "title">;
};

export type DashboardStats = {
  openJobs: number;
  totalJobs: number;
  candidates: number;
  byStage: Record<PipelineStage, number>;
};

// -----------------------------------------------------------------------------
// Jobs
// -----------------------------------------------------------------------------

export async function listJobs(organizationId: string): Promise<JobWithCount[]> {
  const supabase = await createClient();

  const [{ data: jobs }, { data: applications }] = await Promise.all([
    supabase
      .from("jobs")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("applications")
      .select("job_id")
      .eq("organization_id", organizationId),
  ]);

  const counts = new Map<string, number>();
  for (const application of applications ?? []) {
    counts.set(application.job_id, (counts.get(application.job_id) ?? 0) + 1);
  }

  return (jobs ?? []).map((job) => ({
    ...job,
    applicationCount: counts.get(job.id) ?? 0,
  }));
}

export async function getJob(
  organizationId: string,
  jobId: string,
): Promise<Job | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle();

  return data ?? null;
}

/** Jobs reduced to the fields a picker needs, cheapest query for dropdowns. */
export async function listJobOptions(
  organizationId: string,
): Promise<Pick<Job, "id" | "title" | "status">[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select("id, title, status")
    .eq("organization_id", organizationId)
    .order("title", { ascending: true });

  return data ?? [];
}

// -----------------------------------------------------------------------------
// Candidates
// -----------------------------------------------------------------------------

export async function listCandidates(
  organizationId: string,
  search?: string,
): Promise<CandidateWithCount[]> {
  const supabase = await createClient();

  let query = supabase
    .from("candidates")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  const term = search?.trim();
  if (term) {
    // `ilike` is case-insensitive partial matching. The % wildcards are added
    // here, and PostgREST parameterises the value, so this is not string
    // concatenation into SQL.
    query = query.ilike("full_name", `%${term}%`);
  }

  const [{ data: candidates }, { data: applications }] = await Promise.all([
    query,
    supabase
      .from("applications")
      .select("candidate_id")
      .eq("organization_id", organizationId),
  ]);

  const counts = new Map<string, number>();
  for (const application of applications ?? []) {
    counts.set(
      application.candidate_id,
      (counts.get(application.candidate_id) ?? 0) + 1,
    );
  }

  return (candidates ?? []).map((candidate) => ({
    ...candidate,
    applicationCount: counts.get(candidate.id) ?? 0,
  }));
}

export async function getCandidate(
  organizationId: string,
  candidateId: string,
): Promise<Candidate | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("candidates")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", candidateId)
    .maybeSingle();

  return data ?? null;
}

export async function listCandidateOptions(
  organizationId: string,
): Promise<Pick<Candidate, "id" | "full_name">[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("candidates")
    .select("id, full_name")
    .eq("organization_id", organizationId)
    .order("full_name", { ascending: true });

  return data ?? [];
}

// -----------------------------------------------------------------------------
// Applications
// -----------------------------------------------------------------------------

/**
 * Every application in the organization, with the candidate and job fields the
 * Kanban cards and detail lists need. Three indexed queries, joined in memory.
 */
export async function listBoardApplications(
  organizationId: string,
  options: { jobId?: string; candidateId?: string } = {},
): Promise<BoardApplication[]> {
  const supabase = await createClient();

  let applicationQuery = supabase
    .from("applications")
    .select("id, stage, notes, created_at, candidate_id, job_id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (options.jobId) {
    applicationQuery = applicationQuery.eq("job_id", options.jobId);
  }
  if (options.candidateId) {
    applicationQuery = applicationQuery.eq("candidate_id", options.candidateId);
  }

  const [{ data: applications }, { data: candidates }, { data: jobs }] =
    await Promise.all([
      applicationQuery,
      supabase
        .from("candidates")
        .select("id, full_name, email, linkedin_url, location, cv_text")
        .eq("organization_id", organizationId),
      supabase
        .from("jobs")
        .select("id, title")
        .eq("organization_id", organizationId),
    ]);

  const candidateById = new Map(
    (candidates ?? []).map(({ cv_text, ...candidate }) => [
      candidate.id,
      { ...candidate, hasCvText: (cv_text ?? "").trim().length > 0 },
    ]),
  );
  const jobById = new Map((jobs ?? []).map((j) => [j.id, j]));

  const result: BoardApplication[] = [];
  for (const application of applications ?? []) {
    const candidate = candidateById.get(application.candidate_id);
    const job = jobById.get(application.job_id);
    // A missing side would mean the row was filtered out by RLS or deleted
    // concurrently. Skipping is safer than rendering a half-empty card.
    if (!candidate || !job) continue;

    result.push({
      id: application.id,
      stage: application.stage,
      notes: application.notes,
      createdAt: application.created_at,
      candidate,
      job,
    });
  }

  return result;
}

export async function getApplication(
  organizationId: string,
  applicationId: string,
): Promise<Application | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", applicationId)
    .maybeSingle();

  return data ?? null;
}

// -----------------------------------------------------------------------------
// AI assessments
// -----------------------------------------------------------------------------

/** Latest stored AI Match Analysis per application, keyed by application id. */
export async function listLatestAssessments(
  organizationId: string,
  applicationIds: string[],
): Promise<Map<string, CandidateAssessment>> {
  if (applicationIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data } = await supabase
    .from("candidate_assessments")
    .select("*")
    .eq("organization_id", organizationId)
    .in("application_id", applicationIds)
    .order("created_at", { ascending: false });

  const latest = new Map<string, CandidateAssessment>();
  for (const assessment of data ?? []) {
    // Ordered newest first, so the first one wins.
    if (!latest.has(assessment.application_id)) {
      latest.set(assessment.application_id, assessment);
    }
  }
  return latest;
}

// -----------------------------------------------------------------------------
// Dashboard
// -----------------------------------------------------------------------------

export async function getDashboardStats(
  organizationId: string,
): Promise<DashboardStats> {
  const supabase = await createClient();

  const [{ data: jobs }, { count: candidateCount }, { data: applications }] =
    await Promise.all([
      supabase
        .from("jobs")
        .select("status")
        .eq("organization_id", organizationId),
      supabase
        .from("candidates")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId),
      supabase
        .from("applications")
        .select("stage")
        .eq("organization_id", organizationId),
    ]);

  const byStage: Record<PipelineStage, number> = {
    new: 0,
    screening: 0,
    interview: 0,
    offer: 0,
    hired: 0,
    rejected: 0,
  };

  for (const application of applications ?? []) {
    byStage[application.stage] += 1;
  }

  const jobList = jobs ?? [];

  return {
    openJobs: jobList.filter((job) => job.status === "open").length,
    totalJobs: jobList.length,
    candidates: candidateCount ?? 0,
    byStage,
  };
}

export async function listRecentJobs(
  organizationId: string,
  limit = 5,
): Promise<Job[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

export async function listRecentCandidates(
  organizationId: string,
  limit = 5,
): Promise<Candidate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("candidates")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}
