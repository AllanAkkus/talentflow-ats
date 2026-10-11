import { NextResponse } from "next/server";

import { analyzeCandidateMatch } from "@/lib/ai/analyze";
import { getSessionContext } from "@/lib/auth/session";
import { canAccessOrganization } from "@/lib/permissions/access";
import { createClient } from "@/lib/supabase/server";
import { analyzeRequestSchema } from "@/lib/validation/schemas";
import type { AnalyzeCandidateResponse } from "@/types/ai";

/**
 * POST /api/ai/analyze-candidate
 *
 * Body: { "applicationId": "<uuid>" }
 *
 * The client sends nothing but an id. The job description, the CV text, the
 * prompt and the OpenAI key all stay here. Flow:
 *   1. Authenticate the caller                               -> 401
 *   2. Load the application through the caller's RLS client   -> 404 if not
 *      visible to them (which is also what a cross-tenant id looks like)
 *   3. Re-check organization access explicitly                -> 403
 *   4. Load job + candidate server-side
 *   5. Call the model with structured output, validate with Zod
 *   6. Store the result for later, return it
 */
export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = analyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "An application id is required." },
      { status: 422 },
    );
  }

  const supabase = await createClient();

  const { data: application } = await supabase
    .from("applications")
    .select("id, organization_id, candidate_id, job_id")
    .eq("id", parsed.data.applicationId)
    .maybeSingle();

  // RLS already hides other tenants' rows, so this is both a genuine 404 and
  // the correct answer for a probe with someone else's application id.
  if (!application) {
    return NextResponse.json(
      { error: "Application not found." },
      { status: 404 },
    );
  }

  if (!canAccessOrganization(session.profile, application.organization_id)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const [{ data: job }, { data: candidate }] = await Promise.all([
    supabase
      .from("jobs")
      .select("title, description, location, employment_type")
      .eq("id", application.job_id)
      .maybeSingle(),
    supabase
      .from("candidates")
      .select("full_name, location, cv_text")
      .eq("id", application.candidate_id)
      .maybeSingle(),
  ]);

  if (!job || !candidate) {
    return NextResponse.json(
      { error: "The job or candidate for this application no longer exists." },
      { status: 404 },
    );
  }

  const outcome = await analyzeCandidateMatch({
    jobTitle: job.title,
    jobDescription: job.description,
    jobLocation: job.location,
    employmentType: job.employment_type,
    candidateName: candidate.full_name,
    candidateLocation: candidate.location,
    candidateCvText: candidate.cv_text,
  });

  if (!outcome.ok) {
    /*
     * 503 for "the feature is not usable in this environment" (missing key,
     * rejected key, exhausted credits) - the operator has to fix something.
     * 429 passes the provider's rate limit through so a client could back off.
     * 502 for a genuine upstream failure.
     */
    const status =
      outcome.reason === "not_configured" || outcome.reason === "quota_exceeded"
        ? 503
        : outcome.reason === "rate_limited"
          ? 429
          : 502;
    return NextResponse.json({ error: outcome.message }, { status });
  }

  // Cached so the panel can show the previous result on page load, and so a
  // demo does not pay for a model call per refresh. A failed insert must not
  // lose the analysis the user just paid for, so it is not treated as fatal.
  const { data: stored } = await supabase
    .from("candidate_assessments")
    .insert({
      organization_id: application.organization_id,
      application_id: application.id,
      match_score: outcome.analysis.match_score,
      summary: outcome.analysis.summary,
      strengths: outcome.analysis.strengths,
      gaps: outcome.analysis.gaps,
      interview_questions: outcome.analysis.suggested_interview_questions,
      model: outcome.model,
    })
    .select("created_at")
    .maybeSingle();

  const response: AnalyzeCandidateResponse = {
    analysis: outcome.analysis,
    model: outcome.model,
    generatedAt: stored?.created_at ?? new Date().toISOString(),
  };

  return NextResponse.json(response, { status: 200 });
}
