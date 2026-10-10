-- =============================================================================
-- TalentFlow - 003_candidate_assessments.sql
-- Stored results of "AI Match Analysis" (candidate CV vs. one specific job).
--
-- The row is tied to an application, because a match score only means anything
-- in the context of a single job. Results are cached so the demo does not pay
-- for a model call on every page view, and so a recruiter can see what the
-- model said last time.
-- =============================================================================

create table if not exists public.candidate_assessments (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  application_id      uuid not null,
  match_score         integer not null,
  summary             text not null,
  strengths           jsonb not null default '[]'::jsonb,
  gaps                jsonb not null default '[]'::jsonb,
  interview_questions jsonb not null default '[]'::jsonb,
  model               text,
  created_at          timestamptz not null default now(),
  constraint candidate_assessments_score_range check (match_score between 0 and 100),
  constraint candidate_assessments_strengths_is_array check (jsonb_typeof(strengths) = 'array'),
  constraint candidate_assessments_gaps_is_array check (jsonb_typeof(gaps) = 'array'),
  constraint candidate_assessments_questions_is_array check (jsonb_typeof(interview_questions) = 'array'),
  -- Same composite-FK trick as applications: the assessment cannot point at an
  -- application belonging to another tenant.
  constraint candidate_assessments_application_same_org
    foreign key (organization_id, application_id)
    references public.applications (organization_id, id) on delete cascade
);

create index if not exists candidate_assessments_application_idx
  on public.candidate_assessments (application_id, created_at desc);

create index if not exists candidate_assessments_org_idx
  on public.candidate_assessments (organization_id, created_at desc);

alter table public.candidate_assessments enable row level security;

drop policy if exists candidate_assessments_select on public.candidate_assessments;
create policy candidate_assessments_select on public.candidate_assessments
  for select to authenticated
  using (public.tf_is_admin() or organization_id = public.tf_org_id());

drop policy if exists candidate_assessments_insert on public.candidate_assessments;
create policy candidate_assessments_insert on public.candidate_assessments
  for insert to authenticated
  with check (public.tf_is_admin() or organization_id = public.tf_org_id());

drop policy if exists candidate_assessments_delete on public.candidate_assessments;
create policy candidate_assessments_delete on public.candidate_assessments
  for delete to authenticated
  using (public.tf_is_admin() or organization_id = public.tf_org_id());
