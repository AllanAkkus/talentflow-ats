import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { adminClient, parseArgs, requireEnv } from "./_shared";
import { SEED_ORGANIZATIONS } from "./seed-data";
import type { Database } from "../src/types/database";

/**
 * Prove tenant isolation against the real database, not by reading the policy
 * files and hoping.
 *
 *   npm run verify-isolation -- --password "<demo password>"
 *
 * It signs in as a seeded customer from each organization using the anon key -
 * exactly what the browser uses - and then tries, as that user, to:
 *
 *   * read the other tenant's jobs / candidates / applications   (expect 0 rows)
 *   * insert a job stamped with the other tenant's organization_id (expect denied)
 *   * update one of the other tenant's jobs by id                 (expect 0 rows)
 *   * delete one of the other tenant's candidates by id           (expect 0 rows)
 *   * read the other tenant's organization row                    (expect 0 rows)
 *
 * It also confirms a platform admin can see both tenants, so the policies are
 * not simply denying everyone.
 *
 * Exits non-zero if any check fails.
 */

type Check = { name: string; passed: boolean; detail: string };

const checks: Check[] = [];

function record(name: string, passed: boolean, detail: string) {
  checks.push({ name, passed, detail });
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
}

function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function signIn(email: string, password: string) {
  const supabase = anonClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Could not sign in as ${email}: ${error.message}`);
  }
  return supabase;
}

type Tenant = {
  label: string;
  email: string;
  organizationId: string;
  jobId: string;
  candidateId: string;
};

/** Facts about each seeded tenant, gathered with the service-role key. */
async function describeTenants(): Promise<Tenant[]> {
  const admin = adminClient();
  const tenants: Tenant[] = [];

  for (const seed of SEED_ORGANIZATIONS) {
    const { data: organization } = await admin
      .from("organizations")
      .select("id, name")
      .ilike("name", seed.name)
      .maybeSingle();

    if (!organization) {
      throw new Error(
        `Organization "${seed.name}" not found. Run \`npm run seed\` first.`,
      );
    }

    const [{ data: job }, { data: candidate }] = await Promise.all([
      admin
        .from("jobs")
        .select("id")
        .eq("organization_id", organization.id)
        .limit(1)
        .maybeSingle(),
      admin
        .from("candidates")
        .select("id")
        .eq("organization_id", organization.id)
        .limit(1)
        .maybeSingle(),
    ]);

    if (!job || !candidate) {
      throw new Error(
        `"${seed.name}" has no demo job/candidate. Run \`npm run seed\` first.`,
      );
    }

    tenants.push({
      label: organization.name,
      email: seed.users[0].email,
      organizationId: organization.id,
      jobId: job.id,
      candidateId: candidate.id,
    });
  }

  if (tenants.length < 2) {
    throw new Error("Need at least two seeded organizations to test isolation.");
  }

  return tenants;
}

async function testCustomerCannotReachOtherTenant(
  self: Tenant,
  other: Tenant,
  password: string,
) {
  console.log(`\n${self.label} (${self.email}) vs ${other.label}`);
  const supabase = await signIn(self.email, password);

  // --- Reads ----------------------------------------------------------------
  for (const table of ["jobs", "candidates", "applications"] as const) {
    const { data, error } = await supabase
      .from(table)
      .select("id")
      .eq("organization_id", other.organizationId);

    record(
      `cannot read ${other.label} ${table}`,
      !error && (data?.length ?? 0) === 0,
      error ? `error: ${error.message}` : `${data?.length ?? 0} rows returned`,
    );
  }

  // Reading by primary key, with no organization filter at all. This is the
  // check that matters: it proves the filtering is not coming from our own
  // WHERE clause.
  const { data: byId } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", other.jobId);
  record(
    `cannot read ${other.label} job by id`,
    (byId?.length ?? 0) === 0,
    `${byId?.length ?? 0} rows returned`,
  );

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", other.organizationId);
  record(
    `cannot read the ${other.label} organization row`,
    (orgRow?.length ?? 0) === 0,
    `${orgRow?.length ?? 0} rows returned`,
  );

  // --- Writes ---------------------------------------------------------------
  // Org spoofing: a valid session, but a foreign organization_id in the payload.
  const { data: spoofed, error: spoofError } = await supabase
    .from("jobs")
    .insert({
      organization_id: other.organizationId,
      title: "ISOLATION TEST - should never be created",
      status: "draft",
    })
    .select("id");

  record(
    `cannot insert a job into ${other.label} (organization_id spoofing)`,
    Boolean(spoofError) && (spoofed?.length ?? 0) === 0,
    spoofError ? `denied: ${spoofError.code ?? spoofError.message}` : "INSERT SUCCEEDED",
  );

  const { data: updated } = await supabase
    .from("jobs")
    .update({ title: "ISOLATION TEST - should never be applied" })
    .eq("id", other.jobId)
    .select("id");
  record(
    `cannot update a ${other.label} job`,
    (updated?.length ?? 0) === 0,
    `${updated?.length ?? 0} rows affected`,
  );

  const { data: deleted } = await supabase
    .from("candidates")
    .delete()
    .eq("id", other.candidateId)
    .select("id");
  record(
    `cannot delete a ${other.label} candidate`,
    (deleted?.length ?? 0) === 0,
    `${deleted?.length ?? 0} rows affected`,
  );

  // --- Sanity: own tenant still works --------------------------------------
  const { data: ownJobs, error: ownError } = await supabase
    .from("jobs")
    .select("id")
    .eq("organization_id", self.organizationId);
  record(
    `can read own (${self.label}) jobs`,
    !ownError && (ownJobs?.length ?? 0) > 0,
    ownError ? `error: ${ownError.message}` : `${ownJobs?.length ?? 0} rows returned`,
  );

  await supabase.auth.signOut();
}

async function testAdminSeesEverything(
  email: string,
  password: string,
  tenants: Tenant[],
) {
  console.log(`\nPlatform admin (${email})`);
  const supabase = await signIn(email, password);

  const { data: organizations } = await supabase
    .from("organizations")
    .select("id");
  const visible = new Set((organizations ?? []).map((o) => o.id));
  const allVisible = tenants.every((tenant) => visible.has(tenant.organizationId));

  record(
    "can read every organization",
    allVisible,
    `${visible.size} organizations visible`,
  );

  for (const tenant of tenants) {
    const { data } = await supabase
      .from("jobs")
      .select("id")
      .eq("organization_id", tenant.organizationId);
    record(
      `can read ${tenant.label} jobs`,
      (data?.length ?? 0) > 0,
      `${data?.length ?? 0} rows returned`,
    );
  }

  await supabase.auth.signOut();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const password = args.password;

  if (!password) {
    console.error(
      '\nUsage: npm run verify-isolation -- --password "<demo customer password>"' +
        '\n       (optionally --admin-email <email> --admin-password "<password>")\n',
    );
    process.exit(1);
  }

  const tenants = await describeTenants();

  console.log("\nTenant isolation check (anon key + real user sessions)");
  console.log("===========================================================");

  await testCustomerCannotReachOtherTenant(tenants[0], tenants[1], password);
  await testCustomerCannotReachOtherTenant(tenants[1], tenants[0], password);

  if (args["admin-email"] && args["admin-password"]) {
    await testAdminSeesEverything(
      args["admin-email"],
      args["admin-password"],
      tenants,
    );
  } else {
    console.log(
      "\nSkipping the admin check (pass --admin-email and --admin-password to include it).",
    );
  }

  const failed = checks.filter((check) => !check.passed);
  console.log("\n===========================================================");
  console.log(
    `${checks.length - failed.length}/${checks.length} checks passed.`,
  );

  if (failed.length > 0) {
    console.log("\nFailed checks:");
    for (const check of failed) {
      console.log(`  - ${check.name} (${check.detail})`);
    }
    process.exit(1);
  }

  console.log("Tenant isolation verified.\n");
}

main().catch((error: unknown) => {
  console.error("\nIsolation check could not run:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
