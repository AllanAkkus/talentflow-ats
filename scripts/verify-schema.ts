import { Client } from "pg";

import { requireEnv } from "./_shared";

/**
 * Prove the database constraints actually reject what they are supposed to.
 *
 *   npm run verify-schema
 *
 * Everything runs inside a single transaction that is rolled back at the end,
 * so it is safe against a database with real data in it.
 *
 * This connects as the table owner, which bypasses RLS on purpose: the point
 * here is the *schema* - foreign keys, unique and check constraints, triggers.
 * Tenant isolation is a different question and is covered by
 * `npm run verify-isolation`, which signs in as real users with the anon key.
 */

type Check = { name: string; passed: boolean; detail: string };
const checks: Check[] = [];

function record(name: string, passed: boolean, detail = "") {
  checks.push({ name, passed, detail });
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
}

/** Asserts the statement fails, and that it fails for the expected reason. */
async function expectReject(
  client: Client,
  name: string,
  sql: string,
  params: unknown[],
  expected: { code?: string; constraint?: string },
) {
  await client.query("savepoint sp");
  try {
    await client.query(sql, params);
    await client.query("rollback to savepoint sp");
    record(name, false, "the statement SUCCEEDED but should have been rejected");
  } catch (error) {
    await client.query("rollback to savepoint sp");
    const e = error as { code?: string; constraint?: string; message?: string };
    const codeOk = !expected.code || e.code === expected.code;
    const constraintOk = !expected.constraint || e.constraint === expected.constraint;
    record(
      name,
      codeOk && constraintOk,
      `rejected with ${e.code}${e.constraint ? ` / ${e.constraint}` : ""}`,
    );
  }
}

async function expectAccept(
  client: Client,
  name: string,
  sql: string,
  params: unknown[],
) {
  await client.query("savepoint sp");
  try {
    await client.query(sql, params);
    await client.query("release savepoint sp");
    record(name, true);
  } catch (error) {
    await client.query("rollback to savepoint sp");
    const e = error as { code?: string; message?: string };
    record(name, false, `unexpectedly rejected: ${e.code} ${e.message}`);
  }
}

async function main() {
  const client = new Client({
    connectionString: requireEnv("DATABASE_URL"),
    ssl: { rejectUnauthorized: false },
    statement_timeout: 30_000,
  });

  await client.connect();
  await client.query("begin");

  console.log("\nSchema constraint checks (all rolled back afterwards)");
  console.log("===========================================================\n");

  // --- Fixtures: two organizations, in a transaction we will throw away -----
  const { rows: orgs } = await client.query<{ id: string }>(
    `insert into public.organizations (name) values
       ('ZZ Schema Test Org A'), ('ZZ Schema Test Org B')
     returning id`,
  );
  const [orgA, orgB] = orgs.map((row) => row.id);

  const { rows: jobRows } = await client.query<{ id: string }>(
    `insert into public.jobs (organization_id, title, status) values
       ($1, 'Test Job A', 'open'), ($2, 'Test Job B', 'open')
     returning id`,
    [orgA, orgB],
  );
  const [jobA, jobB] = jobRows.map((row) => row.id);

  const { rows: candRows } = await client.query<{ id: string }>(
    `insert into public.candidates (organization_id, full_name) values
       ($1, 'Test Candidate A'), ($2, 'Test Candidate B')
     returning id`,
    [orgA, orgB],
  );
  const [candA, candB] = candRows.map((row) => row.id);

  console.log("organizations / jobs / candidates");
  record("fixtures created in two organizations", true);

  await expectReject(
    client,
    "organization name must be unique (case-insensitive)",
    `insert into public.organizations (name) values ('zz schema test org a')`,
    [],
    { code: "23505" },
  );

  await expectReject(
    client,
    "organization name cannot be blank",
    `insert into public.organizations (name) values ('   ')`,
    [],
    { code: "23514", constraint: "organizations_name_not_blank" },
  );

  console.log("\njobs");
  await expectReject(
    client,
    "job status must be draft/open/closed",
    `insert into public.jobs (organization_id, title, status) values ($1, 'Bad', 'archived')`,
    [orgA],
    { code: "23514", constraint: "jobs_status_valid" },
  );

  await expectReject(
    client,
    "job employment_type must be from the allowed set",
    `insert into public.jobs (organization_id, title, employment_type) values ($1, 'Bad', 'freelance-ish')`,
    [orgA],
    { code: "23514", constraint: "jobs_employment_type_valid" },
  );

  console.log("\ncandidates");
  await expectReject(
    client,
    "candidate email must look like an email",
    `insert into public.candidates (organization_id, full_name, email) values ($1, 'Bad Email', 'not-an-email')`,
    [orgA],
    { code: "23514", constraint: "candidates_email_shape" },
  );

  await expectReject(
    client,
    "candidate linkedin_url must be http(s)",
    `insert into public.candidates (organization_id, full_name, linkedin_url) values ($1, 'Bad URL', 'javascript:alert(1)')`,
    [orgA],
    { code: "23514", constraint: "candidates_linkedin_shape" },
  );

  await expectAccept(
    client,
    "candidate accepts a valid https linkedin_url",
    `insert into public.candidates (organization_id, full_name, linkedin_url) values ($1, 'Good URL', 'https://se.linkedin.com/in/example')`,
    [orgA],
  );

  // --- The interesting ones -------------------------------------------------
  console.log("\napplications (the cross-tenant guarantees)");

  await expectAccept(
    client,
    "application accepts a same-org candidate and job",
    `insert into public.applications (organization_id, candidate_id, job_id) values ($1, $2, $3)`,
    [orgA, candA, jobA],
  );

  await expectReject(
    client,
    "same candidate cannot be added to the same job twice",
    `insert into public.applications (organization_id, candidate_id, job_id) values ($1, $2, $3)`,
    [orgA, candA, jobA],
    { code: "23505", constraint: "applications_candidate_job_unique" },
  );

  await expectReject(
    client,
    "application CANNOT pair org A's candidate with org B's job",
    `insert into public.applications (organization_id, candidate_id, job_id) values ($1, $2, $3)`,
    [orgA, candA, jobB],
    { code: "23503", constraint: "applications_job_same_org" },
  );

  await expectReject(
    client,
    "application CANNOT pair org B's candidate with org A's job",
    `insert into public.applications (organization_id, candidate_id, job_id) values ($1, $2, $3)`,
    [orgA, candB, jobA],
    { code: "23503", constraint: "applications_candidate_same_org" },
  );

  /*
   * Use a *fresh* candidate/job pair here. The first version of this check
   * reused (candA, jobA), which already had an application - so the unique
   * constraint fired first with 23505 and the test reported a failure even
   * though the row was correctly rejected. To actually exercise the composite
   * foreign key, the pair must be one that has no application yet.
   */
  const { rows: freshCand } = await client.query<{ id: string }>(
    `insert into public.candidates (organization_id, full_name)
     values ($1, 'Test Candidate A2') returning id`,
    [orgA],
  );
  const { rows: freshJob } = await client.query<{ id: string }>(
    `insert into public.jobs (organization_id, title, status)
     values ($1, 'Test Job A2', 'open') returning id`,
    [orgA],
  );

  await expectReject(
    client,
    "application CANNOT be stamped with a third organization's id",
    `insert into public.applications (organization_id, candidate_id, job_id) values ($1, $2, $3)`,
    [orgB, freshCand[0].id, freshJob[0].id],
    { code: "23503" },
  );

  await expectReject(
    client,
    "application stage must be a known pipeline stage",
    `insert into public.applications (organization_id, candidate_id, job_id, stage)
     values ($1, $2, $3, 'onboarding')`,
    [orgA, candA, jobA],
    { code: "23514", constraint: "applications_stage_valid" },
  );

  console.log("\nprofiles (role / organization invariants)");
  await expectReject(
    client,
    "a customer profile must have an organization",
    `insert into public.profiles (id, organization_id, full_name, role)
     values (gen_random_uuid(), null, 'Orphan Customer', 'customer')`,
    [],
    { code: "23514", constraint: "profiles_org_matches_role" },
  );

  await expectReject(
    client,
    "a platform admin must NOT have an organization",
    `insert into public.profiles (id, organization_id, full_name, role)
     values (gen_random_uuid(), $1, 'Scoped Admin', 'admin')`,
    [orgA],
    { code: "23514", constraint: "profiles_org_matches_role" },
  );

  await expectReject(
    client,
    "profile role must be admin or customer",
    `insert into public.profiles (id, organization_id, full_name, role)
     values (gen_random_uuid(), $1, 'Weird Role', 'superuser')`,
    [orgA],
    { code: "23514" },
  );

  await expectReject(
    client,
    "profile id must reference a real auth user",
    `insert into public.profiles (id, organization_id, full_name, role)
     values ('00000000-0000-4000-8000-000000000000', $1, 'Ghost', 'customer')`,
    [orgA],
    { code: "23503" },
  );

  console.log("\ncandidate_assessments");
  const { rows: appRows } = await client.query<{ id: string }>(
    `insert into public.applications (organization_id, candidate_id, job_id)
     values ($1, $2, $3) returning id`,
    [orgB, candB, jobB],
  );
  const appB = appRows[0].id;

  await expectReject(
    client,
    "assessment score must be between 0 and 100",
    `insert into public.candidate_assessments
       (organization_id, application_id, match_score, summary)
     values ($1, $2, 140, 'x')`,
    [orgB, appB],
    { code: "23514", constraint: "candidate_assessments_score_range" },
  );

  await expectReject(
    client,
    "assessment CANNOT reference another organization's application",
    `insert into public.candidate_assessments
       (organization_id, application_id, match_score, summary)
     values ($1, $2, 50, 'x')`,
    [orgA, appB],
    { code: "23503", constraint: "candidate_assessments_application_same_org" },
  );

  await expectReject(
    client,
    "assessment strengths must be a JSON array",
    `insert into public.candidate_assessments
       (organization_id, application_id, match_score, summary, strengths)
     values ($1, $2, 50, 'x', '"not-an-array"'::jsonb)`,
    [orgB, appB],
    { code: "23514", constraint: "candidate_assessments_strengths_is_array" },
  );

  console.log("\ntriggers");
  /*
   * The trigger uses now(), which in PostgreSQL is the *transaction* start
   * time - so inside this one transaction it does not advance between the
   * insert and the update. The first version of this check asserted
   * "after > before" and reported a failure even though the trigger worked
   * correctly. What actually matters is that the client's own updated_at value
   * is discarded, so that is what is asserted now.
   */
  await client.query(
    `update public.jobs set title = 'Renamed', updated_at = '1999-01-01' where id = $1`,
    [jobA],
  );
  const { rows: after } = await client.query<{
    updated_at: string;
    matches_now: boolean;
  }>(
    `select updated_at, updated_at = now() as matches_now
     from public.jobs where id = $1`,
    [jobA],
  );
  record(
    "updated_at is set by the trigger and ignores a client-supplied value",
    after[0].matches_now === true,
    `client sent 1999-01-01, stored ${after[0].updated_at}`,
  );

  console.log("\ncascades");
  await client.query(`delete from public.jobs where id = $1`, [jobA]);
  const { rows: orphans } = await client.query<{ count: string }>(
    `select count(*) from public.applications where job_id = $1`,
    [jobA],
  );
  record(
    "deleting a job cascades to its applications",
    orphans[0].count === "0",
    `${orphans[0].count} applications left`,
  );
  const { rows: survivors } = await client.query<{ count: string }>(
    `select count(*) from public.candidates where id = $1`,
    [candA],
  );
  record(
    "deleting a job keeps the candidate in the talent pool",
    survivors[0].count === "1",
  );

  // Nothing above is kept.
  await client.query("rollback");
  await client.end();

  const failed = checks.filter((check) => !check.passed);
  console.log("\n===========================================================");
  console.log(`${checks.length - failed.length}/${checks.length} checks passed.`);
  if (failed.length > 0) {
    console.log("\nFailed:");
    for (const check of failed) console.log(`  - ${check.name} (${check.detail})`);
    process.exit(1);
  }
  console.log("All schema constraints behave as intended.\n");
}

main().catch((error: unknown) => {
  console.error("\nSchema check could not run:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
