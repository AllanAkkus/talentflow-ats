import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import type { Database } from "../src/types/database";

/**
 * Shared bootstrap for the CLI scripts.
 *
 * These scripts run on a developer machine (or in a one-off deploy step), read
 * .env.local directly, and use the service-role key. That is why they live in
 * scripts/ and are never imported by the app.
 */

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    console.error(
      `\nMissing ${name}.\nAdd it to .env.local (see .env.example) and run again.\n`,
    );
    process.exit(1);
  }
  return value;
}

export function adminClient(): SupabaseClient<Database> {
  return createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** Minimal `--flag value` / `--flag=value` parser. */
export function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    const equals = token.indexOf("=");
    if (equals !== -1) {
      args[token.slice(2, equals)] = token.slice(equals + 1);
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[token.slice(2)] = next;
      index += 1;
    } else {
      args[token.slice(2)] = "true";
    }
  }
  return args;
}

/** Readable, high-entropy password for a demo/temporary account. */
export function generatePassword(length = 16): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  const body = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join(
    "",
  );
  return `${body}7`;
}

/**
 * Create an auth user + profile, or reuse the account if the email already
 * exists. Returns the user id.
 *
 * Idempotent on purpose: the seed script must be safe to re-run, and a half
 * finished account (auth user with no profile) is repaired rather than left
 * behind.
 */
export async function ensureUser(
  supabase: SupabaseClient<Database>,
  input: {
    email: string;
    password: string;
    fullName: string;
    role: "admin" | "customer";
    organizationId: string | null;
  },
): Promise<{ id: string; created: boolean }> {
  const { data: created, error } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });

  let userId = created?.user?.id ?? null;
  let wasCreated = Boolean(userId);

  if (error) {
    const alreadyExists = /already (been )?registered|already exists/i.test(
      error.message,
    );
    if (!alreadyExists) throw error;

    // Find the existing account by email.
    const { data: list } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const match = list?.users.find(
      (user) => user.email?.toLowerCase() === input.email.toLowerCase(),
    );
    if (!match) {
      throw new Error(
        `${input.email} already exists but could not be found in the first 1000 users.`,
      );
    }
    userId = match.id;
    wasCreated = false;
  }

  if (!userId) {
    throw new Error(`Could not resolve a user id for ${input.email}.`);
  }

  // upsert so a re-run fixes a profile whose org or role changed.
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      organization_id: input.organizationId,
      full_name: input.fullName,
      role: input.role,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    // Do not leave an auth user that can sign in but has no role.
    if (wasCreated) {
      await supabase.auth.admin.deleteUser(userId);
    }
    throw profileError;
  }

  return { id: userId, created: wasCreated };
}
