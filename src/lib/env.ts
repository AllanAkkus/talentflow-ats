/**
 * Environment access in one place, so a missing variable fails with a readable
 * message instead of `undefined` reaching the Supabase SDK.
 *
 * Only the two NEXT_PUBLIC_* values are safe in the browser bundle. The
 * service-role key and the OpenAI key are read through functions that are only
 * ever called from server code (route handlers, server actions, scripts).
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export function supabaseUrl(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

export function supabaseAnonKey(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** Server-only. Bypasses RLS - never import this into a client component. */
export function supabaseServiceRoleKey(): string {
  return required(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/** Server-only. */
export function openAiKey(): string | null {
  const key = process.env.OPENAI_API_KEY;
  return key && key.trim().length > 0 ? key : null;
}

export function isAiConfigured(): boolean {
  return openAiKey() !== null;
}

export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
