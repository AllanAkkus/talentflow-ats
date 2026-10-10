-- =============================================================================
-- TalentFlow - 001_initial_schema.sql
-- Core multi-tenant ATS schema.
--
-- Tenancy model:
--   organizations  = one tenant (a customer company)
--   profiles       = application-level user record, 1:1 with auth.users
--                    role 'admin'    -> platform admin, organization_id IS NULL
--                    role 'customer' -> belongs to exactly one organization
--   jobs / candidates / applications are always owned by exactly one org.
--
-- Candidate is NOT the same thing as Application. A candidate is a person in
-- the org's talent pool; an application is that person being considered for one
-- specific job. That is what makes candidate<->job a true many-to-many
-- relationship, and it is why job_id is not a column on candidates.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Shared trigger: keep updated_at honest without trusting the client.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- organizations
-- -----------------------------------------------------------------------------
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  constraint organizations_name_not_blank check (length(btrim(name)) > 0)
);

create unique index if not exists organizations_name_unique_ci
  on public.organizations (lower(btrim(name)));

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  full_name       text not null,
  role            text not null,
  created_at      timestamptz not null default now(),
  constraint profiles_role_valid check (role in ('admin', 'customer')),
  constraint profiles_full_name_not_blank check (length(btrim(full_name)) > 0),
  -- A customer is meaningless without a tenant; a platform admin is global.
  constraint profiles_org_matches_role check (
    (role = 'customer' and organization_id is not null)
    or (role = 'admin' and organization_id is null)
  )
);

create index if not exists profiles_organization_id_idx
  on public.profiles (organization_id);

-- -----------------------------------------------------------------------------
-- jobs
-- -----------------------------------------------------------------------------
create table if not exists public.jobs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title           text not null,
  description     text,
  location        text,
  employment_type text,
  status          text not null default 'draft',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint jobs_title_not_blank check (length(btrim(title)) > 0),
  constraint jobs_status_valid check (status in ('draft', 'open', 'closed')),
  constraint jobs_employment_type_valid check (
    employment_type is null
    or employment_type in ('full_time', 'part_time', 'contract', 'internship', 'temporary')
  )
);

-- Composite unique key so applications can reference (organization_id, job_id)
-- declaratively. This makes a cross-tenant application impossible at the
-- database level, not only at the policy level.
alter table public.jobs drop constraint if exists jobs_org_id_unique;
alter table public.jobs add constraint jobs_org_id_unique unique (organization_id, id);

create index if not exists jobs_org_status_idx on public.jobs (organization_id, status);
create index if not exists jobs_org_created_idx on public.jobs (organization_id, created_at desc);

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- candidates
-- -----------------------------------------------------------------------------
create table if not exists public.candidates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  full_name       text not null,
  email           text,
  phone           text,
  linkedin_url    text,
  location        text,
  cv_text         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint candidates_full_name_not_blank check (length(btrim(full_name)) > 0),
  constraint candidates_email_shape check (
    email is null or email like '%_@_%._%'
  ),
  constraint candidates_linkedin_shape check (
    linkedin_url is null or linkedin_url ilike 'http://%' or linkedin_url ilike 'https://%'
  )
);

alter table public.candidates drop constraint if exists candidates_org_id_unique;
alter table public.candidates add constraint candidates_org_id_unique unique (organization_id, id);

create index if not exists candidates_org_created_idx
  on public.candidates (organization_id, created_at desc);

-- Supports case-insensitive partial name search inside a tenant.
create index if not exists candidates_org_name_lower_idx
  on public.candidates (organization_id, lower(full_name));

drop trigger if exists candidates_set_updated_at on public.candidates;
create trigger candidates_set_updated_at
  before update on public.candidates
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- applications  (the candidate <-> job join, carrying pipeline state)
-- -----------------------------------------------------------------------------
create table if not exists public.applications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  candidate_id    uuid not null,
  job_id          uuid not null,
  stage           text not null default 'new',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint applications_stage_valid check (
    stage in ('new', 'screening', 'interview', 'offer', 'hired', 'rejected')
  ),
  -- The same person cannot be registered twice on the same job.
  constraint applications_candidate_job_unique unique (candidate_id, job_id),
  -- Candidate and job must live in the SAME organization as the application.
  constraint applications_candidate_same_org
    foreign key (organization_id, candidate_id)
    references public.candidates (organization_id, id) on delete cascade,
  constraint applications_job_same_org
    foreign key (organization_id, job_id)
    references public.jobs (organization_id, id) on delete cascade
);

create index if not exists applications_org_stage_idx on public.applications (organization_id, stage);
create index if not exists applications_job_idx on public.applications (job_id);
create index if not exists applications_candidate_idx on public.applications (candidate_id);

drop trigger if exists applications_set_updated_at on public.applications;
create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();
