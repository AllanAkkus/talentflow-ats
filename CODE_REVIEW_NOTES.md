# Code review notes

The purpose of this document is so you can defend this codebase in a technical
conversation without having to re-read it. Part 1 explains how it works and why.
Part 2 is 46 questions a reviewer is likely to ask, with concise answers that
match the actual implementation.

Read part 1 once. Skim part 2 the morning of the interview.

---

# Part 1 — How it works

## The one-paragraph version

TalentFlow is one Next.js app talking to one Supabase project. Supabase gives
us authentication and a PostgreSQL database. Multi-tenancy — the guarantee that
customer A cannot see customer B's data — is enforced *inside PostgreSQL* using
Row Level Security, not by filtering in the frontend. All application code
(Server Components, server actions, API routes) runs under the signed-in user's
own identity, so those policies apply to everything. One single key can bypass
them — the service-role key — and it is used in exactly one place in the app:
creating accounts, which has to be server-side.

## Why this stack

**Why Next.js?** Because the alternative is two deployments. With the App Router
I get server-rendered pages, the API routes, and the mutations (server actions)
in one codebase and one deploy. For a product that is mostly "read some rows,
render a list, write a row back", a separate backend would be ceremony. It also
means data fetching happens on the server, so I am never shipping a database
query to the browser.

**Why TypeScript?** The domain has a lot of near-miss values: a stage is one of
six strings, a role is one of two, a job status one of three, and
`organization_id` appears on five tables. Those are exactly the mistakes a type
system catches for free. `strict` is on and there is no `as any` anywhere.

**Why Supabase?** Because it collapses three decisions into one. I get managed
Postgres (a real relational database, which this domain needs), authentication
with session handling I do not have to write, and — the actual reason —
**Row Level Security**, which lets me put the tenant boundary in the database
instead of in my code. Building auth myself would have been the single riskiest
thing I could do with a short deadline.

## Supabase Auth, concretely

Sign-in posts email and password to a **server action**. The server calls
`signInWithPassword`, Supabase returns an access token and a refresh token, and
`@supabase/ssr` writes them as HttpOnly cookies. The browser never touches the
tokens in JavaScript.

On every subsequent request:

1. `src/proxy.ts` runs first (this is Next 16's name for what used to be
   `middleware.ts`). It refreshes the access token if it is close to expiring.
   This has to live here because **Server Components cannot write cookies**, so
   something upstream of them has to do the refresh.
2. The page or route handler calls `getSessionContext()`, which calls
   `supabase.auth.getUser()`. That is a deliberate choice over
   `auth.getSession()`: `getSession()` only *decodes* the cookie, while
   `getUser()` revalidates the JWT against Supabase. A forged cookie fails.
3. It then loads the matching `profiles` row to find out the user's role and
   organization.

Sign-out clears the Supabase session and the active-organization cookie.

## The data model, and the one decision that matters

Five tables plus one for AI results:

- `organizations` — a tenant, i.e. a customer company.
- `profiles` — one row per auth user, holding `full_name`, `role` and
  `organization_id`. A check constraint enforces: a `customer` must have an
  organization; an `admin` must not.
- `jobs` — a role being recruited for.
- `candidates` — a person in that organization's talent pool.
- `applications` — **the candidate ↔ job relationship**, carrying the stage.
- `candidate_assessments` — a stored AI analysis for one application.

### Candidate vs application

This is the interesting part of the model, and it is worth being able to explain
in one breath:

> A candidate is a *person*. An application is *that person being considered for
> one specific job*. The stage belongs to the application, not to the person.

Which means candidate-to-job is **many-to-many**, and `applications` is the join
table — except that it is not a pure join table, because it carries its own
state (`stage`, `notes`, timestamps). In the demo data Johan Nilsson is in two
pipelines at once; he could be at `interview` on Backend Developer and
`rejected` on Frontend Developer at the same time.

If I had instead put a `job_id` column on `candidates`, a person could only ever
be on one job, and the only workaround would be to duplicate the person per job
— which destroys the talent pool, breaks search, and makes deduplication
impossible.

### Why composite foreign keys

`applications` does not reference `candidates(id)` and `jobs(id)`. It references
`candidates(organization_id, id)` and `jobs(organization_id, id)`, which is
possible because both tables have `unique (organization_id, id)`.

The effect: an application whose candidate belongs to org A and whose job belongs
to org B is **rejected by Postgres**, not by a policy and not by my code. The
usual way to enforce that is a trigger; this is declarative, so there is no
procedural code to get wrong.

## Multi-tenancy — the part to be able to explain under pressure

Three helper functions read the caller's profile:

```sql
tf_role()      -- 'admin' | 'customer'
tf_org_id()    -- the caller's organization_id (NULL for an admin)
tf_is_admin()  -- boolean
```

They are **`SECURITY DEFINER`**. The reason is specific: policies *on*
`profiles` need to know the caller's role, so they call these functions, which
read `profiles`. Without `SECURITY DEFINER` that would recurse infinitely.
`SECURITY DEFINER` makes the function run as its owner, who is not subject to
RLS, which breaks the cycle.

Then every business table has the same four policies, scoped `to authenticated`:

```sql
for select using      (tf_is_admin() or organization_id = tf_org_id())
for insert with check (tf_is_admin() or organization_id = tf_org_id())
for update using      (...) with check (...)
for delete using      (tf_is_admin() or organization_id = tf_org_id())
```

Four things to point at:

1. **`to authenticated`** — the `anon` role has *no* policy on any table. An
   unauthenticated request to the Supabase REST endpoint gets nothing back. That
   does not depend on my app.
2. **`USING` on SELECT** — other tenants' rows do not exist from the caller's
   point of view. A lookup by primary key returns zero rows. That is why a
   foreign id produces a 404 and not a 403: a 403 would confirm the row exists.
3. **`WITH CHECK` on INSERT/UPDATE** — this is the anti-spoofing control.
   `organization_id` is a writable column. Without `WITH CHECK`, a customer with
   a perfectly valid session could `INSERT` a row stamped with another tenant's
   id.
4. **`tf_is_admin()`** — admins pass every policy. That is what lets one code
   path serve both roles instead of a parallel admin API.

### Layers on top (defence in depth)

- Every read in `lib/data/` *also* filters `organization_id` explicitly. That is
  for correctness and index use, not security.
- Every write resolves the organization **server-side** from the session
  (`lib/actions/context.ts`). The client never supplies an `organization_id`.
- An admin's active organization lives in an HttpOnly cookie, but
  `resolveActiveOrganizationId()` re-validates it every request and **ignores it
  entirely for customers**. That function is unit-tested, including the case
  where a customer's request asks for a different org.
- `lib/supabase/admin.ts` imports `"server-only"`, so the build fails if the
  service-role client is ever imported into a client component.

### And it is tested for real

`npm run verify-isolation` signs in as a seeded customer from each organization
**using the anon key — exactly what the browser uses** — and then tries to cross
the boundary: reads, a primary-key read with no org filter at all, an `INSERT`
with a foreign `organization_id`, an `UPDATE` by id, a `DELETE` by id. It also
asserts the user *can* still read their own rows, so the suite cannot pass by
denying everything. Non-zero exit if anything gets through.

## How an admin creates accounts

Creating an auth user requires the Supabase **Auth Admin API**, which requires
the **service-role key**, which bypasses RLS. So this cannot happen in the
browser. `POST /api/admin/users` does it, in this order:

1. Is there a valid session? → `401`
2. Does the caller's own `profiles` row say `role = 'admin'`? → `403`
   (the role comes from the database, never from the request)
3. Does the body pass the Zod schema? → `422`
4. Resolve or create the organization (customers only).
5. Create the auth user via the Admin API.
6. Insert the matching `profiles` row.
7. **If step 6 fails, delete the auth user again.**

Step 7 is a *compensating delete*, not a transaction — Supabase Auth and the
Postgres table cannot be committed atomically from outside the database. The
failure mode it prevents is the bad one: an account that can sign in but has no
role. (And if that delete also failed, `getSessionContext()` treats a user with
no profile as not signed in, so they still cannot do anything.)

## anon key vs service-role key

| | anon / publishable key | service-role key |
| --- | --- | --- |
| Where it may live | browser and server | **server only** |
| RLS | fully applies | **bypassed entirely** |
| Auth Admin API | no | yes |
| Used in this app for | everything the user does | `POST /api/admin/users`, the CLI scripts |

The anon key is *public by design*. It identifies the project, it does not
authorize anything — the user's JWT does that, and RLS enforces it. That is why
shipping it to the browser is safe.

The service-role key is effectively `postgres` plus user administration. Leaking
it means every tenant's data is readable and every account is forgeable. It is
never prefixed `NEXT_PUBLIC_`, it is read through a function that is only called
from server code, and the module that uses it is marked `"server-only"`.

## Server vs client code

- **Server Components** (default) — all the pages. They read from
  `lib/data/*.ts`, which is marked `"server-only"`. No query ever reaches the
  browser.
- **Server actions** (`"use server"`) — all the writes. Reachable by direct POST,
  so every one of them re-authenticates and re-authorizes; they never trust an
  argument that decides permissions.
- **Client Components** (`"use client"`) — only where interaction demands it: the
  login form, the Kanban board, dialogs, the stage dropdowns, the AI panel.
- **Route handlers** — the two things that are genuinely API-shaped: account
  creation and the AI call.

The split is visible in the import graph rather than being a convention you have
to remember. `"server-only"` in `lib/env.server.ts`, `lib/supabase/admin.ts`,
`lib/data/*`, `lib/auth/session.ts`, `lib/permissions/workspace.ts` and
`lib/ai/analyze.ts` turns a mistake into a build failure. `lib/env.ts` exports
*only* the two public Supabase values; every secret is in `env.server.ts`.

## How the Kanban works

`/pipeline` is a Server Component. It loads the organization's applications and
jobs, then hands them to one client component, `PipelineBoard`.

- **Filtering** (job, name, show-rejected) happens in the browser, in
  `lib/pipeline/filter.ts` — a pure function with no React and no Supabase in
  it, which is why it is unit-tested. That is what makes filtering feel instant.
  It is a UX decision: the rows were already restricted to one tenant by the
  query *and* by RLS before they reached the browser.
- **Stage changes** go through `updateApplicationStageAction`. The dropdown was
  built first — it is the reliable path, works with a keyboard and on touch — and
  dnd-kit drag-and-drop was layered on afterwards calling the *same* action.
- **Optimism**: `useOptimistic` holds an unconfirmed stage override. If the
  action fails, the override is discarded when the transition ends, so the card
  snaps back on its own, and an error banner explains why. On success,
  `revalidatePath` sends fresh props and the override is dropped.

Only the grip handle starts a drag (`setActivatorNodeRef`), so the links and the
dropdown inside each card stay clickable.

## How the AI analysis works

The browser POSTs `{ applicationId }` to `/api/ai/analyze-candidate`. That is
all it sends. The server then:

1. Authenticates the caller.
2. Loads the application through the caller's own RLS-bound client — so another
   tenant's id simply returns nothing, which is a genuine 404.
3. Re-checks organization access explicitly with `canAccessOrganization()`, so
   the answer is a clean 403 rather than a confusing empty result.
4. Loads the job and the candidate server-side.
5. Builds the prompt and calls OpenAI with
   `response_format: { type: "json_schema", strict: true }`.
6. `JSON.parse`, then **re-validates with Zod anyway**. Belt and braces: the
   schema should guarantee the shape, but the app only touches data that passed
   our own schema.
7. Stores the result in `candidate_assessments` and returns it.

**Why structured output?** Because otherwise I would be regex-ing prose out of a
paragraph, and any prompt drift would show up as broken UI. With a schema, a bad
response is an *error* I can display, not a rendering bug. It also keeps the
shape stable enough to store in a table.

**Why decision support and not ranking?** Two reasons, and both are worth
saying out loud:

- *It is hiring.* An LLM's score reflects its training data and how the CV was
  written, not someone's ability. Automating a rejection on that basis is both
  ethically bad and, under the EU AI Act, in a high-risk category with
  obligations I am not meeting in a one-week MVP.
- *It has not been evaluated.* I have no ground truth, no calibration, and no
  monitoring of score distributions across groups. Ranking candidates on an
  unevaluated score would be presenting noise as signal.

So the model gets no authority: it never changes a stage, the prompt forbids a
hire/reject recommendation, the prompt rules out protected characteristics, the
response schema has no field that could carry one, and the panel always carries
*"AI-generated decision support. Final hiring decisions should be made by a
human."*

**No key?** The panel says it is not configured in this environment. Nothing is
faked and nothing else breaks.

## Validation

Every write path parses its input with a Zod schema from
`lib/validation/schemas.ts` before touching the database. Server actions and the
API routes share the same schemas, so the client and the server cannot drift.

Worth knowing specifically:

- Optional text fields collapse `""` and whitespace to `null`, so the database
  never stores an empty string that means "unset".
- `emailSchema` normalises *before* validating. It used to do the opposite, which
  rejected a login email with a trailing space — a real bug the tests caught.
- LinkedIn URLs must parse as a URL with an `http:` or `https:` protocol. That is
  not pedantry: it is what stops a `javascript:` URL ending up in an `href`.
  There is a test for exactly that.
- Stage, role and status are enums, so the database check constraints should be
  unreachable. They are the backstop, not the error message.
- The database *also* validates: check constraints on role/status/stage, shape
  checks on email and LinkedIn, non-blank names, and a score between 0 and 100.

## Deployment

Vercel for the app, Supabase for auth plus database. Environment variables are
set in Vercel; the two server-only secrets are not prefixed `NEXT_PUBLIC_`, so
they are never inlined into the client bundle. The schema is applied from
`supabase/schema.sql` (generated from the migrations) and the first admin is
created with `npm run create-admin`.

## What I would do with another week

In priority order:

1. **An audit log** of every stage change and record edit. For a hiring tool
   this is the highest-value missing feature, and it is the foundation for
   answering "why was this candidate rejected" six months later.
2. **CV PDF upload** to Supabase Storage with tenant-scoped access policies,
   plus server-side text extraction into `cv_text`.
3. **Email invitations and password reset**, so admins stop handling passwords.
4. **Stage history** and a real funnel (time-in-stage, conversion per stage)
   built on the audit log.
5. **Server-side search and pagination** everywhere, plus `tsvector` full-text
   search over CV text.
6. **A proper transaction for account creation** — a Postgres function invoked
   over RPC, or an Edge Function, so the auth user and the profile commit
   together instead of relying on a compensating delete.
7. **AI evaluation**: version the prompt, log inputs and outputs, human-score a
   sample, and watch score distributions for disparate impact before anyone is
   allowed to sort by the score.
8. **Playwright smoke test in CI**: login → create job → add candidate → assign
   → move stage, plus a cross-tenant 404 assertion.

---

# Part 2 — Questions and answers

## Data model

**1. Why not just store `job_id` on the candidate?**
Because a candidate can be considered for several jobs at once, and the same
person can be at different stages on each. A `job_id` column allows exactly one
job per person. The only workaround is duplicating the person per job, which
destroys the talent pool: search returns the same human three times,
deduplication becomes impossible, and editing a phone number means editing it
in three places.

**2. So why an `applications` table?**
It is the many-to-many join between candidates and jobs, and it is also where
the state lives. The pipeline stage is a property of "this person on this job",
not of the person — which is precisely what an application row is.

**3. Is `applications` a pure join table?**
No. A pure join table would only have the two foreign keys. This one carries
`stage`, `notes`, `created_at` and `updated_at`, so it is a domain entity in its
own right. That is the normal shape when a relationship has its own lifecycle.

**4. How do you stop the same candidate being added to the same job twice?**
`unique (candidate_id, job_id)`. The server action also catches Postgres error
`23505` and turns it into "This candidate is already on that job." The UI
additionally filters already-assigned options out of the picker, but the
constraint is what actually guarantees it.

**5. What stops an application pointing at a candidate from one org and a job
from another?**
Composite foreign keys. `applications` references
`candidates(organization_id, id)` and `jobs(organization_id, id)`, backed by
`unique (organization_id, id)` on both. The mismatch is a foreign-key violation
in Postgres. Most people use a trigger for this; the declarative version has no
procedural code to get wrong.

**6. Why is `organization_id` denormalised onto every table?**
Two reasons. It makes the RLS policies a single-column comparison instead of a
join, which keeps them readable and fast. And it is what makes the composite
foreign key above possible. The cost is that it has to be kept correct — which
is exactly what the FKs and the `WITH CHECK` policies do.

**7. What happens to applications when a job is deleted?**
`on delete cascade` — they go with it. The candidates stay in the talent pool,
which is the behaviour a recruiter expects: closing a role does not delete
people. Deleting a *candidate* cascades to their applications.

**8. Why no stage history?**
Scope. Only the current stage is stored. It is the first thing I would add,
together with an audit log, because for a hiring tool "who moved this candidate
to rejected, and when" is a question you will eventually be asked.

**9. Why are the pipeline stages hard-coded?**
Because configurable stages per tenant means a `stages` table, an ordering
column, migration of existing applications when a stage is removed, and a board
that renders an arbitrary number of columns. For an MVP it is a lot of
complexity for a feature no first customer has asked for yet. The six stages
cover a normal funnel.

**10. Why is `rejected` not a board column by default?**
Rejected grows without bound and would dominate the board visually. It is a
checkbox instead, and the count is always visible on the toggle. It is still a
real stage in the database, not a soft delete.

## Multi-tenancy and security

**11. Why isn't frontend filtering enough for tenant isolation?**
Because the frontend is not a security boundary — it is a rendering suggestion.
Anyone can open devtools, read the anon key out of the bundle, and call the
Supabase REST API directly with their own session token. If the only thing
stopping them is a `.filter()` in React, they get everything. The check has to
live where the data lives.

**12. What is Row Level Security?**
A Postgres feature where a policy is attached to a table and is applied to every
query automatically, inside the database. A `SELECT` with no `WHERE` clause
silently becomes a `SELECT` restricted to the rows the policy allows. It cannot
be bypassed by changing the query, because it is not part of the query.

**13. Walk me through one of your policies.**
```sql
create policy jobs_select on public.jobs
  for select to authenticated
  using (public.tf_is_admin() or organization_id = public.tf_org_id());
```
`to authenticated` means the `anon` role is not covered at all, so an
unauthenticated request gets nothing. `tf_org_id()` returns the caller's own
organization from their profile row. So a customer sees their org's jobs, and an
admin sees all of them. Insert and update have the same expression in
`WITH CHECK`.

**14. What happens if someone changes `organization_id` in a request?**
Nothing useful. Three things stop it. The write path never reads an
`organization_id` from the client — it resolves it server-side from the session.
If it somehow did, the `WITH CHECK` on the INSERT/UPDATE policy rejects any row
whose `organization_id` is not the caller's. And the composite foreign keys
reject a cross-tenant combination independently of that. There is a test in
`verify-isolation` that performs exactly this attack and asserts it is denied.

**15. What about tampering with the active-organization cookie?**
It is HttpOnly, but assume they can set it anyway. For a customer the cookie is
**ignored entirely** — `resolveActiveOrganizationId()` returns their profile's
organization regardless of what was asked for. For an admin the value is only
honoured if it is a real organization id, and an admin is allowed into every
organization anyway, so there is nothing to escalate to. This function is
unit-tested with the spoofing case.

**16. Why is the service-role key dangerous?**
Because it bypasses RLS completely and can call the Auth Admin API. It is
effectively superuser plus user administration. With it you can read every
tenant's data and create an admin account for yourself. That is why it is
server-only, never `NEXT_PUBLIC_`-prefixed, and why the module that uses it
imports `"server-only"` so the build fails if it is ever pulled client-side.

**17. Then why is it safe to put the anon key in the browser?**
Because it authorizes nothing. It identifies the project; the user's JWT
identifies the user, and RLS decides what that user may see. An anon key with no
session gets nothing back from any table, because no policy covers the `anon`
role.

**18. Why `SECURITY DEFINER` on the helper functions?**
Because a policy on `profiles` needs the caller's role, which means reading
`profiles` — and that would trigger the policy again, recursing forever.
`SECURITY DEFINER` makes the function execute as its owner, who is not subject
to RLS, which breaks the cycle. They also have `set search_path = public` so the
definer context cannot be hijacked by a manipulated `search_path`.

**19. Doesn't `SECURITY DEFINER` introduce its own risk?**
It would if the functions took arguments or did anything but one fixed read.
They take no parameters, return one scalar derived from `auth.uid()`, have a
pinned `search_path`, and `EXECUTE` is revoked from `public` and `anon` and
granted only to `authenticated`. There is no input to inject.

**20. How did you verify isolation rather than assume it?**
`npm run verify-isolation`. It signs in as a real seeded customer from each
organization with the anon key — the same credentials path the browser uses —
and then attempts cross-tenant reads, a primary-key read with no org filter at
all, an INSERT carrying a foreign `organization_id`, an UPDATE by id, and a
DELETE by id. It also asserts the user can still read their *own* rows, so the
suite cannot pass by denying everything. It exits non-zero on any success.

**21. Why does a foreign id give a 404 and not a 403?**
Because a 403 confirms the record exists. RLS makes other tenants' rows
invisible, so the lookup legitimately returns zero rows and the honest answer is
"not found". The one place I return 403 is the AI endpoint, after the row was
already visible to the caller — there, denying with a clear reason is more useful
than a misleading 404.

**22. Server actions are reachable by direct POST. Does that worry you?**
It is exactly why every one of them re-authenticates and re-resolves the
organization server-side instead of trusting arguments. The pattern is in
`lib/actions/context.ts`: `getWriteContext()` is the first thing every write
calls, and it derives identity and tenant from the session, not from the
payload.

**23. What stops an unauthenticated user reaching `/pipeline`?**
Three layers. `src/proxy.ts` redirects to `/login`. The `(app)` route group's
layout calls `requireSessionContext()`, so a page that forgot its own guard is
still protected. And if both somehow failed, RLS returns no rows to an
unauthenticated client, so there would be nothing to render.

**24. How do you know no secret is in the client bundle?**
Structurally rather than by inspection, in three layers. Next.js only inlines
`NEXT_PUBLIC_`-prefixed variables, and neither secret is prefixed. The secrets
are reachable only through `lib/env.server.ts`, which imports `"server-only"`,
so a client import is a *build error* rather than a silent leak. And
`.gitignore` ignores `.env*`, un-ignoring only `.env.example`. I also grep the
tracked tree for JWT- and `sk-`-shaped strings before pushing.

**25. What's your worst remaining security gap?**
Rate limiting. `/api/ai/analyze-candidate` requires a session but a legitimate
user could loop it and run up an OpenAI bill. There is also no brute-force
protection on login beyond what Supabase does by default. Neither leaks data,
but both are things I would add before real customers.

## Authentication

**26. How does session authentication work end to end?**
Sign-in happens in a server action; Supabase returns an access token (short
lived) and a refresh token, and `@supabase/ssr` writes both as HttpOnly cookies.
`src/proxy.ts` runs on every request and refreshes the access token when needed,
because Server Components cannot write cookies. Each page then resolves the user
with `auth.getUser()` and loads their profile for role and organization.

**27. Why `getUser()` instead of `getSession()`?**
`getSession()` only decodes the cookie — it will happily report a session for a
token it did not verify. `getUser()` revalidates the JWT with Supabase. The cost
is a network call per request; the benefit is that a forged or revoked token
does not produce a logged-in session. For an app where the whole point is tenant
isolation, that is the right trade.

**28. Why no public signup?**
Because it is a B2B product sold to companies. Self-registration would let
anyone create an organization, and it would raise "which tenant does this new
user belong to?" with no good answer. Admins onboard customers. This is also
stated in the brief.

**29. Then how was the first admin created?**
`npm run create-admin -- --email … --name …`. It uses the service-role key, so
it cannot run inside the product — there is no admin yet to authorize it. The
password is printed once to the terminal and is written nowhere, so no
credential ends up in the repository.

**30. Why is the login error message vague?**
"Incorrect email or password" for both cases, so the form cannot be used to
enumerate which email addresses have accounts.

**31. Could the `?next=` redirect be abused as an open redirect?**
No. It is only used if it starts with a single `/` — `//evil.com` and absolute
URLs are rejected and fall back to `/dashboard`.

**32. What happens if an auth user exists but has no profile row?**
`getSessionContext()` returns null, so they are treated as not signed in. They
have no role, so there is nothing they could be permitted to do, and failing
closed is the right default. Account creation actively avoids producing this
state by deleting the auth user if the profile insert fails.

## Admin and account creation

**33. What happens when an admin creates a user and the DB insert fails?**
The route deletes the auth user it just created and returns a 500 saying the
account was rolled back. That prevents the dangerous state: an account that can
authenticate but has no role or tenant.

**34. That's not a transaction. How would you make it one?**
Move the whole operation into Postgres and call it over RPC — a
`SECURITY DEFINER` function that creates the identity row and the profile in one
transaction — or run it in an Edge Function that owns both sides. The real
constraint is that Supabase Auth and my table are two systems from outside the
database, so a true two-phase commit is not available at the client level. For
an MVP a compensating delete that fails safe is the honest trade-off, and it is
documented as a limitation rather than hidden.

**35. Why is account creation a route handler rather than a server action?**
Because it is genuinely API-shaped: a future invite flow, an onboarding script
or an internal tool would call the same endpoint. It also makes the
authentication and authorization checks directly exercisable with `curl`, which
matters for something this sensitive.

**36. How does organization switching work for admins?**
Picking an organization calls a server action, which verifies the caller is an
admin and that the organization exists, then sets an HttpOnly cookie. Every
request afterwards passes that cookie through `resolveActiveOrganizationId()`,
which re-validates it — and ignores it completely for customers. So there is one
code path for both roles: the rest of the app just asks "which organization am
I rendering?" and does not care how the answer was reached.

**37. Why is the active organization so prominent in the UI?**
Because the worst admin mistake in a tool like this is adding a candidate to the
wrong customer. It is a tinted control in the top bar on every page, and every
page heading names the organization.

## Performance and scale

**38. How would you scale this to 100,000 candidates?**
Four changes, in order. Paginate every list (keyset pagination on
`(organization_id, created_at, id)`, which the existing indexes already
support). Move pipeline filtering server-side with the filters as query
parameters. Replace `ilike '%term%'` with a `tsvector` column and a GIN index —
a leading wildcard cannot use a B-tree. And aggregate the dashboard counters in
the database (`count(*) ... group by stage`) instead of fetching rows to count
them in JavaScript.

**39. Would client-side board filtering still work at that scale?**
No, and that is the point of calling it out as a trade-off. It works because an
organization currently has hundreds of applications, not hundreds of thousands.
At that size the board would move to server-side filtering with pagination per
column. Nothing about the security model changes — the filtering was never the
boundary.

**40. How would search change?**
Today it is `ilike '%term%'` against `(organization_id, lower(full_name))`. For
name search at scale: a `pg_trgm` GIN index, which can serve a leading wildcard.
For searching inside CV text: a `tsvector` column maintained by a trigger, with
a GIN index and `websearch_to_tsquery`. Both stay inside the same RLS policies.

**41. Do you have any N+1 queries?**
No. Reads that span tables issue two or three bulk queries and join in memory —
for example the board loads applications, candidates and jobs once each and
builds two `Map`s. The counts on the jobs and candidates lists are computed the
same way rather than per row.

**42. Why in-memory joins instead of PostgREST embedding?**
Partly pragmatic, partly deliberate. The hand-maintained `Database` type has
empty `Relationships`, so supabase-js cannot type-check embedded selects; and
the composite foreign keys make embedding ambiguous enough to need explicit FK
hints. Three indexed queries at this scale are inconsequential, and the code is
easier to reason about. At larger scale I would generate the types with the
Supabase CLI and switch to embedding or a view.

**43. Why are the database types hand-written?**
The Supabase CLI was not available in the build environment. They are written in
the exact shape `supabase gen types typescript` emits, so they can be replaced
with generated output without touching a single call site. The migrations remain
the source of truth.

## AI

**44. Why is the AI decision support rather than automatic ranking?**
Because it is hiring, and because the model has not been evaluated. An LLM score
reflects its training data and how well someone writes a CV, not their ability —
so ranking on it would present noise as signal and would systematically
disadvantage people who write CVs differently. Under the EU AI Act, automated
candidate ranking is a high-risk use with obligations an MVP is not meeting.
Decision support with a human in the loop gives the recruiter the useful part
(structured reading of a CV against a job) without handing the model authority.

**45. What risks are there in using LLMs for hiring?**
Bias in training data reproducing historical hiring patterns; proxy
discrimination, where a name or a university stands in for a protected
characteristic; a false sense of objectivity, because a number looks more
rigorous than an opinion; non-determinism, so the same CV can score differently
twice; hallucinated experience the CV never mentioned; and the legal exposure
that comes from automating a decision you cannot explain.

**46. How do you prevent sensitive information from affecting the analysis?**
Four ways, and none of them is purely the prompt. The prompt explicitly forbids
inferring, mentioning or scoring gender, ethnicity, race, nationality, religion,
age, health or disability, sexual orientation, pregnancy or family status, and
tells the model to ignore names and dates of birth as signals. The response
schema has **no field** that could carry such a trait, so there is nowhere for it
to surface. Temperature is 0.2 to reduce drift. And the output is advisory, so
even a bad answer cannot act on its own. What I have *not* done is strip
identifying details from the CV before sending it — that is the real next step,
and I would pair it with monitoring score distributions across groups.

**47. Why force structured output?**
Because the alternative is parsing prose, which breaks the moment the model
phrases something differently. With `json_schema` and `strict: true` the shape is
enforced at generation time, so a malformed answer becomes a clean error instead
of broken UI — and the shape is stable enough to store in a table and render
without defensive checks everywhere.

**48. You validate with Zod after a strict JSON schema. Isn't that redundant?**
Slightly, and deliberately. The schema is enforced by a third party I do not
control; the Zod parse is enforced by me. It also bounds things the JSON schema
does not (string lengths, array sizes) and means every value the app touches has
passed the same validation layer as every other input. It costs microseconds.

**49. What happens if OpenAI is unavailable?**
The call has a 60-second timeout and one retry. On failure the route returns 502
with a readable message and the panel shows it. Nothing else in the ATS is
affected — the AI call is not on the path of any page render. If the key is
missing entirely the panel reports "not configured in this environment" and the
button is not offered.

**50. Why cache assessments in a table?**
So the last result is visible on page load without another model call, so a demo
or a page refresh does not cost money, and so there is a record of what the model
said at the time. It is also the table I would extend with prompt and model
version for evaluation.

## Testing and process

**51. Why so few tests?**
Because I had a deadline and chose coverage of the parts where a silent
regression actually matters: the Zod schemas, the permission helpers, and the
pipeline filtering. 53 tests. They are pure functions with no mocking, so they
run in 300ms and they test behaviour rather than implementation. What I did not
do is write shallow component tests that assert markup — those cost time and
catch almost nothing.

**52. Did the tests find anything, or are they decoration?**
They found a real bug. `emailSchema` validated the email *before* trimming it,
so `" me@example.com "` — exactly what browser autofill and copy-paste produce —
was rejected as invalid and would have shown up as "incorrect email or
password" on a valid login. They also found a wrong *test*: I asserted that
searching "berg" returns only Bergström, when it correctly also returns
Sandberg. Both are written up in `PROJECT_LOG.md`.

**53. What would you test next?**
A Playwright smoke test through the real journey — login, create job, add
candidate, assign, move stage — plus a cross-tenant assertion that customer A
gets a 404 on customer B's job URL. And `pgTAP` tests for the RLS policies
themselves, so a policy regression fails in CI rather than in
`verify-isolation` run by hand.

**54. What would production monitoring look like?**
Sentry for errors on both server and client, with the release tagged. Vercel
analytics for Core Web Vitals and function duration. Supabase's own slow-query
and connection-pool metrics. Structured logs on the two API routes with a
request id. A synthetic check that logs in and loads `/pipeline` every few
minutes. And for the AI feature specifically: per-call latency, cost, failure
rate and the score distribution over time.

**55. How much of this did AI write, and do you understand it?**
Most of the code was written with Claude Code, which the brief encouraged. The
parts that mattered I directed and verified: I chose the tenancy model and the
RLS approach, I checked the Next 16 conventions against the bundled docs in
`node_modules/next/dist/docs/` rather than trusting training data, and I ran
lint, typecheck, tests and build on everything. I also found and fixed two real
bugs in the generated drag-and-drop code — a duplicated `setNodeRef` that made
the whole card a drag handle, and a stage change that fired the server action
twice because the card's dropdown and the board's handler both called it.
`PROJECT_LOG.md` records that honestly, including the failures.

**56. What are you least happy with?**
Account creation not being transactional. A compensating delete is the right
MVP answer, but "two systems, no shared transaction" is the kind of thing that
produces a weird support ticket at 2am. Second would be the absence of an audit
log — for a hiring tool, not being able to answer "who moved this candidate and
when" is a real gap, and it is first on my list.
