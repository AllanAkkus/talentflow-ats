import { createServerClient } from "@supabase/ssr";

import { adminClient, parseArgs, requireEnv } from "./_shared";
import type { Database } from "../src/types/database";

/**
 * End-to-end verification of the running app over HTTP, as real signed-in
 * users.
 *
 *   npm run start                                   # in another terminal
 *   npm run verify-app -- --password "<demo pw>" --admin-email <e> --admin-password "<pw>"
 *   npm run verify-app -- --base-url https://<deployment> ...
 *
 * How it signs in: it builds a @supabase/ssr server client backed by an
 * in-memory cookie jar, calls signInWithPassword, and then replays the cookies
 * that client wrote as a Cookie header on plain fetches. Those are the same
 * cookies the browser would hold, so every request goes through the app's real
 * render path: proxy -> layout guard -> Server Component -> RLS.
 *
 * This is what proves the *product* is isolated, not just the database:
 * verify-isolation talks to PostgREST directly, this goes through the UI.
 */

type Jar = Map<string, string>;

function cookieHeader(jar: Jar): string {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

type Session = { jar: Jar; supabase: ReturnType<typeof createServerClient<Database>> };

async function signIn(email: string, password: string): Promise<Session> {
  const jar: Jar = new Map();

  const supabase = createServerClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return [...jar.entries()].map(([name, value]) => ({ name, value }));
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) jar.set(name, value);
        },
      },
    },
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  if (jar.size === 0) throw new Error(`no session cookies were set for ${email}`);

  return { jar, supabase };
}

type Check = { name: string; passed: boolean; detail: string };
const checks: Check[] = [];

function record(name: string, passed: boolean, detail = "") {
  checks.push({ name, passed, detail });
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
}

type PageExpect = {
  path: string;
  status?: number;
  redirectsTo?: string;
  contains?: string[];
  excludes?: string[];
  label?: string;
};

async function checkPage(
  baseUrl: string,
  jar: Jar,
  expect: PageExpect,
  extraCookies: Record<string, string> = {},
) {
  const cookies = [cookieHeader(jar)];
  for (const [name, value] of Object.entries(extraCookies)) {
    cookies.push(`${name}=${value}`);
  }

  const response = await fetch(`${baseUrl}${expect.path}`, {
    headers: { cookie: cookies.join("; ") },
    redirect: "manual",
  });

  const label = expect.label ?? expect.path;
  const expectedStatus = expect.status ?? 200;

  if (response.status !== expectedStatus) {
    record(
      label,
      false,
      `expected ${expectedStatus}, got ${response.status}${
        response.headers.get("location")
          ? ` -> ${response.headers.get("location")}`
          : ""
      }`,
    );
    return;
  }

  if (expect.redirectsTo) {
    const location = response.headers.get("location") ?? "";
    record(
      label,
      location.startsWith(expect.redirectsTo),
      `${response.status} -> ${location}`,
    );
    return;
  }

  if (!expect.contains && !expect.excludes) {
    record(label, true, `${response.status}`);
    return;
  }

  const html = await response.text();
  const missing = (expect.contains ?? []).filter((text) => !html.includes(text));
  const leaked = (expect.excludes ?? []).filter((text) => html.includes(text));

  record(
    label,
    missing.length === 0 && leaked.length === 0,
    [
      missing.length ? `missing: ${missing.join(", ")}` : "",
      leaked.length ? `LEAKED: ${leaked.join(", ")}` : "",
      !missing.length && !leaked.length ? `${response.status}, content ok` : "",
    ]
      .filter(Boolean)
      .join(" | "),
  );
}

async function postJson(
  baseUrl: string,
  jar: Jar,
  path: string,
  body: unknown,
): Promise<{ status: number; json: unknown }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { cookie: cookieHeader(jar), "content-type": "application/json" },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return { status: response.status, json };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = (args["base-url"] ?? "http://localhost:3000").replace(/\/$/, "");
  const password = args.password;
  const adminEmail = args["admin-email"];
  const adminPassword = args["admin-password"];

  if (!password || !adminEmail || !adminPassword) {
    console.error(
      '\nUsage: npm run verify-app -- --password "<demo customer pw>" ' +
        '--admin-email <email> --admin-password "<pw>" [--base-url <url>]\n',
    );
    process.exit(1);
  }

  // Facts about the seeded data, read with the service-role key.
  const admin = adminClient();
  const { data: orgs } = await admin.from("organizations").select("id, name").order("name");
  const northstar = orgs?.find((o) => o.name.includes("Northstar"));
  const lumen = orgs?.find((o) => o.name.includes("Lumen"));
  if (!northstar || !lumen) {
    throw new Error("Demo organizations not found. Run `npm run seed` first.");
  }

  const [nsJob, lmJob, nsCand, lmCand, nsApp, lmApp] = await Promise.all([
    admin.from("jobs").select("id, title").eq("organization_id", northstar.id).limit(1).single(),
    admin.from("jobs").select("id, title").eq("organization_id", lumen.id).limit(1).single(),
    admin.from("candidates").select("id, full_name").eq("organization_id", northstar.id).limit(1).single(),
    admin.from("candidates").select("id, full_name").eq("organization_id", lumen.id).limit(1).single(),
    admin.from("applications").select("id").eq("organization_id", northstar.id).limit(1).single(),
    admin.from("applications").select("id").eq("organization_id", lumen.id).limit(1).single(),
  ]);

  console.log(`\nApp verification against ${baseUrl}`);
  console.log("===========================================================");

  // --- Anonymous -----------------------------------------------------------
  console.log("\nAnonymous visitor");
  const empty: Jar = new Map();
  await checkPage(baseUrl, empty, { path: "/login", status: 200, contains: ["Sign in to TalentFlow"] });
  await checkPage(baseUrl, empty, { path: "/dashboard", status: 307, redirectsTo: "/login" });
  await checkPage(baseUrl, empty, { path: "/pipeline", status: 307, redirectsTo: "/login" });
  await checkPage(baseUrl, empty, { path: "/admin/users", status: 307, redirectsTo: "/login" });
  {
    const r = await postJson(baseUrl, empty, "/api/admin/users", { email: "a@b.co" });
    record("POST /api/admin/users is 401 JSON", r.status === 401, `status ${r.status}`);
    const r2 = await postJson(baseUrl, empty, "/api/ai/analyze-candidate", { applicationId: nsApp.data!.id });
    record("POST /api/ai/analyze-candidate is 401 JSON", r2.status === 401, `status ${r2.status}`);
  }

  // --- Customer A (Northstar) ---------------------------------------------
  console.log("\nCustomer A - anna@northstar.example.com (Northstar Consulting AB)");
  const { jar: jarA, supabase: supaA } = await signIn(
    "anna@northstar.example.com",
    password,
  );

  await checkPage(baseUrl, jarA, {
    path: "/dashboard",
    contains: ["Northstar Consulting AB"],
    excludes: ["Lumen Health AB"],
  });
  await checkPage(baseUrl, jarA, {
    path: "/jobs",
    contains: [nsJob.data!.title],
    excludes: [lmJob.data!.title],
  });
  await checkPage(baseUrl, jarA, {
    path: "/candidates",
    contains: [nsCand.data!.full_name],
    excludes: [lmCand.data!.full_name],
  });
  await checkPage(baseUrl, jarA, {
    path: "/pipeline",
    contains: [nsJob.data!.title],
    excludes: [lmJob.data!.title],
  });
  await checkPage(baseUrl, jarA, {
    path: "/candidates?q=anna",
    label: "/candidates?q=anna (server-side search)",
    contains: ["Anna Andersson"],
    excludes: ["Erik Lindqvist"],
  });

  // Customers must not reach the admin area at all.
  await checkPage(baseUrl, jarA, {
    path: "/admin/organizations",
    status: 307,
    redirectsTo: "/dashboard",
    label: "/admin/organizations redirects a customer away",
  });
  await checkPage(baseUrl, jarA, {
    path: "/admin/users",
    status: 307,
    redirectsTo: "/dashboard",
    label: "/admin/users redirects a customer away",
  });

  /*
   * Cross-tenant detail pages render the not-found UI and, critically, contain
   * none of the other tenant's data.
   *
   * The status is 200 rather than 404: the app streams dynamic pages, so by the
   * time notFound() is raised the shell has already been flushed and Next
   * cannot change the status. What matters for isolation is the body, so that
   * is what is asserted - plus the not-found UI's own copy, to prove the real
   * page did not render. Logged as a known limitation in README.md rather than
   * papered over with a lenient assertion.
   */
  await checkPage(baseUrl, jarA, {
    path: `/jobs/${lmJob.data!.id}`,
    contains: ["belongs to another organization"],
    excludes: [lmJob.data!.title, "Lumen Health"],
    label: "another tenant's job detail leaks nothing and shows not-found",
  });
  await checkPage(baseUrl, jarA, {
    path: `/candidates/${lmCand.data!.id}`,
    contains: ["belongs to another organization"],
    excludes: [lmCand.data!.full_name, "Lumen Health"],
    label: "another tenant's candidate detail leaks nothing and shows not-found",
  });

  /*
   * The cookie-spoofing test, through the real app rather than the database:
   * forge tf_active_org to point at the other tenant. A customer's active
   * organization comes from their profile, so the cookie must change nothing.
   */
  await checkPage(
    baseUrl,
    jarA,
    {
      path: "/jobs",
      contains: [nsJob.data!.title],
      excludes: [lmJob.data!.title, "Lumen Health AB"],
      label: "forged tf_active_org cookie does NOT move a customer to another tenant",
    },
    { tf_active_org: lumen.id },
  );

  {
    const r = await postJson(baseUrl, jarA, "/api/admin/users", {
      email: "escalate@example.com",
      password: "Password1234",
      fullName: "Escalation Attempt",
      role: "admin",
    });
    record(
      "customer calling POST /api/admin/users is 403",
      r.status === 403,
      `status ${r.status}`,
    );
  }
  {
    const r = await postJson(baseUrl, jarA, "/api/ai/analyze-candidate", {
      applicationId: lmApp.data!.id,
    });
    record(
      "AI analysis of another tenant's application is 404",
      r.status === 404,
      `status ${r.status}`,
    );
  }
  {
    const r = await postJson(baseUrl, jarA, "/api/ai/analyze-candidate", {
      applicationId: nsApp.data!.id,
    });
    const message =
      typeof r.json === "object" && r.json !== null && "error" in r.json
        ? String((r.json as { error: unknown }).error)
        : "";
    const configured = process.env.OPENAI_API_KEY?.trim();
    if (configured) {
      record("AI analysis of own application returns a result", r.status === 200, `status ${r.status}`);
    } else {
      record(
        "AI analysis reports 'not configured' when there is no API key",
        r.status === 503 && /not configured/i.test(message),
        `status ${r.status}: ${message}`,
      );
    }
  }

  /*
   * --- Customer A: the write path, end to end --------------------------------
   *
   * Reads alone do not show that CRUD works. These run as the signed-in
   * customer through the RLS-bound client - the same identity and the same
   * policies the server actions use - and then confirm the result actually
   * shows up on the rendered Kanban board. Everything created here is deleted
   * again at the end.
   */
  console.log("\nCustomer A - create -> assign -> move stage -> verify on board");

  const stamp = Date.now();
  const newJobTitle = `ZZ Verify Job ${stamp}`;
  const newCandidateName = `ZZ Verify Candidate ${stamp}`;

  const { data: createdJob, error: jobError } = await supaA
    .from("jobs")
    .insert({
      organization_id: northstar.id,
      title: newJobTitle,
      description: "Created by verify-app.",
      status: "open",
    })
    .select("id, organization_id")
    .single();
  record(
    "customer can create a job in their own organization",
    !jobError && Boolean(createdJob),
    jobError ? `error: ${jobError.message}` : "created",
  );

  const { data: createdCandidate, error: candidateError } = await supaA
    .from("candidates")
    .insert({
      organization_id: northstar.id,
      full_name: newCandidateName,
      email: `verify-${stamp}@example.com`,
      linkedin_url: "https://www.linkedin.com/in/example-verify",
    })
    .select("id")
    .single();
  record(
    "customer can create a candidate with a LinkedIn URL",
    !candidateError && Boolean(createdCandidate),
    candidateError ? `error: ${candidateError.message}` : "created",
  );

  if (createdJob && createdCandidate) {
    const { data: createdApp, error: appError } = await supaA
      .from("applications")
      .insert({
        organization_id: northstar.id,
        candidate_id: createdCandidate.id,
        job_id: createdJob.id,
      })
      .select("id, stage")
      .single();
    record(
      "assigning the candidate to the job creates an application at stage 'new'",
      !appError && createdApp?.stage === "new",
      appError ? `error: ${appError.message}` : `stage=${createdApp?.stage}`,
    );

    // The duplicate guard, as a customer rather than as the table owner.
    const { error: dupError } = await supaA.from("applications").insert({
      organization_id: northstar.id,
      candidate_id: createdCandidate.id,
      job_id: createdJob.id,
    });
    record(
      "the same candidate cannot be assigned to the same job twice",
      dupError?.code === "23505",
      dupError ? `denied: ${dupError.code}` : "DUPLICATE WAS ACCEPTED",
    );

    if (createdApp) {
      const { data: moved, error: moveError } = await supaA
        .from("applications")
        .update({ stage: "interview" })
        .eq("id", createdApp.id)
        .select("id, stage")
        .single();
      record(
        "customer can move the application to another stage",
        !moveError && moved?.stage === "interview",
        moveError ? `error: ${moveError.message}` : `stage=${moved?.stage}`,
      );

      await checkPage(baseUrl, jarA, {
        path: "/pipeline",
        contains: [newCandidateName, newJobTitle],
        label: "the new candidate appears on the rendered Kanban board",
      });

      await checkPage(baseUrl, jarA, {
        path: `/candidates?q=${encodeURIComponent(`ZZ Verify Candidate ${stamp}`)}`,
        contains: [newCandidateName],
        label: "the new candidate is found by server-side name search",
      });

      await checkPage(baseUrl, jarA, {
        path: `/jobs/${createdJob.id}`,
        contains: [newJobTitle, newCandidateName],
        label: "the job detail page lists the assigned candidate",
      });
    }

    // Clean up. Deleting the job cascades to the application.
    await supaA.from("jobs").delete().eq("id", createdJob.id);
    await supaA.from("candidates").delete().eq("id", createdCandidate.id);

    const { data: leftovers } = await supaA
      .from("jobs")
      .select("id")
      .eq("id", createdJob.id);
    record(
      "customer can delete their own job (cleanup)",
      (leftovers?.length ?? 0) === 0,
      `${leftovers?.length ?? 0} rows remain`,
    );
  }

  // --- Customer B (Lumen) --------------------------------------------------
  console.log("\nCustomer B - lisa@lumenhealth.example.com (Lumen Health AB)");
  const { jar: jarB } = await signIn("lisa@lumenhealth.example.com", password);

  await checkPage(baseUrl, jarB, {
    path: "/dashboard",
    contains: ["Lumen Health AB"],
    excludes: ["Northstar Consulting AB"],
  });
  await checkPage(baseUrl, jarB, {
    path: "/jobs",
    contains: [lmJob.data!.title],
    excludes: [nsJob.data!.title],
  });
  await checkPage(baseUrl, jarB, {
    path: "/candidates",
    contains: [lmCand.data!.full_name],
    excludes: [nsCand.data!.full_name],
  });
  await checkPage(baseUrl, jarB, {
    path: `/jobs/${nsJob.data!.id}`,
    contains: ["belongs to another organization"],
    excludes: [nsJob.data!.title, "Northstar Consulting"],
    label: "another tenant's job detail leaks nothing and shows not-found",
  });

  // --- Platform admin ------------------------------------------------------
  console.log(`\nPlatform admin - ${adminEmail}`);
  const { jar: jarAdmin } = await signIn(adminEmail, adminPassword);

  await checkPage(baseUrl, jarAdmin, {
    path: "/admin/organizations",
    contains: ["Northstar Consulting AB", "Lumen Health AB"],
    label: "/admin/organizations lists every tenant",
  });
  await checkPage(baseUrl, jarAdmin, {
    path: "/admin/users",
    contains: ["anna@northstar.example.com", "lisa@lumenhealth.example.com", "Platform admin"],
    label: "/admin/users lists users with emails and roles",
  });

  // Org switching: the same URL renders a different tenant per cookie.
  await checkPage(
    baseUrl,
    jarAdmin,
    {
      path: "/jobs",
      contains: [nsJob.data!.title],
      excludes: [lmJob.data!.title],
      label: "admin with tf_active_org=Northstar sees Northstar's jobs",
    },
    { tf_active_org: northstar.id },
  );
  await checkPage(
    baseUrl,
    jarAdmin,
    {
      path: "/jobs",
      contains: [lmJob.data!.title],
      excludes: [nsJob.data!.title],
      label: "admin with tf_active_org=Lumen sees Lumen's jobs",
    },
    { tf_active_org: lumen.id },
  );
  await checkPage(
    baseUrl,
    jarAdmin,
    {
      path: `/jobs/${lmJob.data!.id}`,
      contains: [lmJob.data!.title],
      label: "admin can open any tenant's job detail",
    },
    { tf_active_org: lumen.id },
  );

  // --- Report --------------------------------------------------------------
  const failed = checks.filter((check) => !check.passed);
  console.log("\n===========================================================");
  console.log(`${checks.length - failed.length}/${checks.length} checks passed.`);
  if (failed.length > 0) {
    console.log("\nFailed:");
    for (const check of failed) console.log(`  - ${check.name} (${check.detail})`);
    process.exit(1);
  }
  console.log("App-level journeys and isolation verified.\n");
}

main().catch((error: unknown) => {
  console.error("\nApp verification could not run:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
