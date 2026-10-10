import "server-only";

import { required } from "@/lib/env";

/**
 * Server-only environment access.
 *
 * Everything in here is a secret. The `"server-only"` import above means the
 * build fails if any client component pulls this module in - the secret
 * boundary is enforced by the module graph rather than by remembering a
 * convention.
 *
 * (Next.js also only inlines `NEXT_PUBLIC_*` variables into the client bundle,
 * so these values could never be substituted there anyway. This makes the
 * mistake loud instead of leaving a function that silently returns undefined.)
 */

/** Bypasses Row Level Security and can call the Auth Admin API. */
export function supabaseServiceRoleKey(): string {
  return required(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/** Null when AI Match Analysis is not configured in this environment. */
export function openAiKey(): string | null {
  const key = process.env.OPENAI_API_KEY;
  return key && key.trim().length > 0 ? key : null;
}

export function isAiConfigured(): boolean {
  return openAiKey() !== null;
}

export const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
