import type { SupabaseClient } from "@supabase/supabase-js";

import { adminClient, ensureUser, generatePassword, parseArgs } from "./_shared";
import { SEED_ORGANIZATIONS, type SeedOrganization } from "./seed-data";
import type { Database } from "../src/types/database";

/**
 * Seed two demo tenants with jobs, candidates and a populated pipeline.
 *
 *   npm run seed
 *   npm run seed -- --password "Demo-Password-1"   # same password for all demo users
 *
 * Safe to re-run: organizations are matched by name, jobs by (org, title),
 * candidates by (org, email), and applications by (candidate, job). Nothing is
 * duplicated and nothing is deleted.
 *
 * This is a script rather than supabase/seed.sql because the demo data includes
 * real auth users, which can only be created through the Auth Admin API.
 */

type Ids = Map<string, string>;

async function ensureOrganization(
  supabase: SupabaseClient<Database>,
  name: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("organizations")
    .select("id")
    .ilike("name", name)
    .maybeSingle();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("organizations")
    .insert({ name })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error(`Could not create organization ${name}`);
  }
  return data.id;
}

async function seedJobs(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  organization: SeedOrganization,
): Promise<Ids> {
  const ids: Ids = new Map();

  for (const job of organization.jobs) {
    const { data: existing } = await supabase
      .from("jobs")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("title", job.title)
      .maybeSingle();

    if (existing) {
      ids.set(job.key, existing.id);
      continue;
    }

    const { data, error } = await supabase
      .from("jobs")
      .insert({
        organization_id: organizationId,
        title: job.title,
        description: job.description,
        location: job.location,
        employment_type: job.employmentType,
        status: job.status,
      })
      .select("id")
      .single();

    if (error || !data) throw error ?? new Error(`Job ${job.title} failed`);
    ids.set(job.key, data.id);
  }

  return ids;
}

async function seedCandidates(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  organization: SeedOrganization,
): Promise<Ids> {
  const ids: Ids = new Map();

  for (const candidate of organization.candidates) {
    const { data: existing } = await supabase
      .from("candidates")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", candidate.email)
      .maybeSingle();

    if (existing) {
      ids.set(candidate.key, existing.id);
      continue;
    }

    const { data, error } = await supabase
      .from("candidates")
      .insert({
        organization_id: organizationId,
        full_name: candidate.fullName,
        email: candidate.email,
        phone: candidate.phone,
        linkedin_url: candidate.linkedinUrl,
        location: candidate.location,
        cv_text: candidate.cvText,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw error ?? new Error(`Candidate ${candidate.fullName} failed`);
    }
    ids.set(candidate.key, data.id);
  }

  return ids;
}

async function seedApplications(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  organization: SeedOrganization,
  jobIds: Ids,
  candidateIds: Ids,
): Promise<number> {
  let created = 0;

  for (const application of organization.applications) {
    const candidateId = candidateIds.get(application.candidateKey);
    const jobId = jobIds.get(application.jobKey);
    if (!candidateId || !jobId) {
      throw new Error(
        `Seed data references a missing key: ${application.candidateKey} / ${application.jobKey}`,
      );
    }

    const { data: existing } = await supabase
      .from("applications")
      .select("id")
      .eq("candidate_id", candidateId)
      .eq("job_id", jobId)
      .maybeSingle();

    if (existing) continue;

    const { error } = await supabase.from("applications").insert({
      organization_id: organizationId,
      candidate_id: candidateId,
      job_id: jobId,
      stage: application.stage,
      notes: application.notes ?? null,
    });

    if (error) throw error;
    created += 1;
  }

  return created;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sharedPassword = args.password ?? generatePassword();
  const supabase = adminClient();

  // Fail fast with a readable message if the migrations have not been applied.
  const { error: schemaError } = await supabase
    .from("organizations")
    .select("id")
    .limit(1);

  if (schemaError) {
    console.error(
      "\nCould not read the organizations table. Have the migrations in supabase/migrations/ been applied?\n",
    );
    console.error(schemaError.message);
    process.exit(1);
  }

  const credentials: { email: string; password: string; organization: string }[] =
    [];

  for (const organization of SEED_ORGANIZATIONS) {
    const organizationId = await ensureOrganization(supabase, organization.name);

    for (const user of organization.users) {
      const { created } = await ensureUser(supabase, {
        email: user.email,
        password: sharedPassword,
        fullName: user.fullName,
        role: "customer",
        organizationId,
      });
      credentials.push({
        email: user.email,
        password: created ? sharedPassword : "(existing account - unchanged)",
        organization: organization.name,
      });
    }

    const jobIds = await seedJobs(supabase, organizationId, organization);
    const candidateIds = await seedCandidates(
      supabase,
      organizationId,
      organization,
    );
    const newApplications = await seedApplications(
      supabase,
      organizationId,
      organization,
      jobIds,
      candidateIds,
    );

    console.log(
      `${organization.name}: ${jobIds.size} jobs, ${candidateIds.size} candidates, ${newApplications} new applications`,
    );
  }

  console.log("");
  console.log("Demo customer accounts");
  console.log("-----------------------------------------------------------");
  for (const credential of credentials) {
    console.log(`  ${credential.email}`);
    console.log(`    password:     ${credential.password}`);
    console.log(`    organization: ${credential.organization}`);
  }
  console.log("-----------------------------------------------------------");
  console.log(
    "Two organizations are seeded on purpose: sign in as a user from each to",
  );
  console.log("confirm neither can see the other's jobs, candidates or pipeline.");
  console.log("");
  console.log("All names, emails, phone numbers and CVs above are fictional.");
  console.log("");
}

main().catch((error: unknown) => {
  console.error("\nSeeding failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
