/**
 * Public environment access.
 *
 * Only the two `NEXT_PUBLIC_*` Supabase values live here, because this module
 * is imported by the browser client. Secrets live in `env.server.ts`, which is
 * marked `"server-only"` so importing it from a client component is a build
 * error rather than a silent leak.
 */

export function required(name: string, value: string | undefined): string {
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
