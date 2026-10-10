/**
 * Shared shape for every `useActionState` form in the app.
 *
 * Lives in its own module because a `"use server"` file may only export async
 * functions - types and constants are not allowed there.
 */
export type FormState = {
  status: "idle" | "error" | "success";
  /** Form-level message: a server error, or a confirmation after a write. */
  message?: string | null;
  /** Per-field validation messages, keyed by input name. */
  errors?: Record<string, string>;
  /** Values echoed back so the user does not lose what they typed. */
  values?: Record<string, string>;
};

export const IDLE_STATE: FormState = { status: "idle" };

export type MutationResult =
  | { ok: true }
  | { ok: false; message: string };

/** Maps a Postgres/PostgREST error to something a recruiter can act on. */
export function describeDatabaseError(error: {
  code?: string;
  message?: string;
}): string {
  switch (error.code) {
    case "23505":
      return "That record already exists.";
    case "23503":
      return "A referenced record no longer exists. Reload the page and try again.";
    case "23514":
      return "Some values were rejected by the database. Check the form and try again.";
    case "42501":
      return "You do not have permission to do that.";
    default:
      return error.message ?? "Something went wrong. Please try again.";
  }
}
