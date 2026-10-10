# Assumptions

Decisions taken while building TalentFlow where the brief left room for
judgement. Everything listed here matches what the code actually does.

## Tenancy and users

- **An organization is the tenant.** Jobs, candidates, applications and AI
  assessments all belong to exactly one organization.
- **A customer user belongs to exactly one organization.** This is enforced by a
  database check constraint, not only by convention: a `profiles` row with
  `role = 'customer'` must have a non-null `organization_id`.
- **One organization can have several customer users.** They see the same data.
  There is no per-user role inside an organization (no "hiring manager" vs
  "recruiter") in the MVP.
- **Platform admins are global.** `role = 'admin'` with `organization_id` NULL,
  again enforced by the same check constraint. An admin can read and write every
  organization's data and acts on a customer's behalf by selecting that
  organization.
- **An admin's "active organization" is server-resolved.** It is stored in an
  HttpOnly cookie, but the cookie is re-validated on every request and is
  ignored entirely for customer users, so editing it grants nothing.
- **No public signup.** `/login` is the only unauthenticated page. Accounts are
  created by an admin, and the very first admin is created with the
  `create-admin` script because it cannot be created from inside the product.
- **Passwords are handed over out of band.** No SMTP is configured, so new
  accounts are created pre-confirmed and the admin copies the generated password
  to the user. Email invitation flows are a next step, not part of the MVP.

## Domain model

- **A candidate is not an application.** A candidate is a person in an
  organization's talent pool. An application is that person being considered for
  one specific job, and it carries the pipeline stage.
- **Candidate-to-job is many-to-many**, expressed through `applications`. This is
  why there is no `job_id` column on `candidates`.
- **The same candidate cannot be registered twice on the same job.** Enforced by
  a unique constraint on `(candidate_id, job_id)`.
- **A candidate and a job on the same application must belong to the same
  organization.** Enforced declaratively by composite foreign keys on
  `(organization_id, id)`, so a cross-tenant application is impossible at the
  database level.
- **Each application has exactly one current stage.** There is no stage history
  or audit trail in the MVP.
- **Pipeline stages are fixed:** `new`, `screening`, `interview`, `offer`,
  `hired`, `rejected`. Per-customer configurable stages are out of scope.
- **`rejected` is a filter, not a board column by default.** Keeping it off the
  board keeps the Kanban readable; a checkbox reveals it.
- **Deleting a job removes its applications** but keeps the candidates in the
  talent pool. Deleting a candidate removes that candidate's applications.
- **Job statuses are `draft`, `open`, `closed`.** Only `open` counts towards
  "Open jobs" on the dashboard; draft and closed jobs still appear in lists and
  in the pipeline job filter.

## CV handling and AI

- **CV text is pasted as plain text.** This was a deliberate scope decision:
  pasting a CV is reliable and takes seconds, whereas PDF upload plus text
  extraction is a sub-project with its own storage, permissions and parsing
  edge cases. PDF parsing via Supabase Storage is documented as the next step.
- **AI Match Analysis is advisory.** It never changes a stage, never accepts or
  rejects anyone, and the UI states that the final decision is a human's.
- **The model is asked for job-relevant evidence only.** The prompt explicitly
  forbids inferring or scoring protected characteristics, and the response
  schema contains no field that could carry one.
- **The AI feature is optional.** Without `OPENAI_API_KEY` the panel reports that
  it is not configured in this environment, and every other part of the ATS
  works normally. Nothing is faked.
- **Assessments are cached, not live.** The latest stored result is shown on page
  load; the recruiter re-runs it explicitly. This keeps cost and latency
  predictable.

## Scale and architecture

- **This is MVP scale.** Hundreds of candidates per organization, not hundreds of
  thousands. The pipeline board loads an organization's applications once and
  filters them in the browser, which is why filtering feels instant.
- **Client-side filtering is a UX choice, never a security control.** The rows
  are already restricted to one organization by the query *and* by Row Level
  Security before they reach the browser.
- **Multi-table reads use two or three bulk queries joined in memory** rather
  than PostgREST embedding. At this scale that is a handful of indexed lookups,
  and it avoids embedding ambiguity introduced by the composite foreign keys.
- **The database types are hand-maintained** in `src/types/database.ts`, in the
  same shape `supabase gen types typescript` produces, because the Supabase CLI
  was not available in the build environment. The migrations remain the source
  of truth.
- **Soft deletes, audit logs and activity feeds are out of scope.** Deletes are
  real deletes.
- **One shared Postgres schema with RLS**, not a schema or database per tenant.
  For this product shape it is the right trade-off: one migration path, one
  connection pool, and isolation that is enforced by the database.
