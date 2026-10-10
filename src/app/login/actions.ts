"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ACTIVE_ORG_COOKIE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, loginSchema } from "@/lib/validation/schemas";
import { cookies } from "next/headers";

export type LoginState = {
  formError?: string;
  errors?: Record<string, string>;
  values?: { email: string };
};

/**
 * Sign in with email + password.
 *
 * Runs as a server action so the Supabase session cookies are set with
 * HttpOnly by the server rather than being managed in client JavaScript.
 * Errors are returned as state instead of thrown, so the form can show them
 * inline and keep the typed email.
 */
export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const raw = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      errors: fieldErrors(parsed.error),
      values: { email: raw.email },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Deliberately generic: distinguishing "no such user" from "wrong password"
    // would let anyone enumerate which emails have accounts.
    return {
      formError: "Incorrect email or password.",
      values: { email: raw.email },
    };
  }

  // A previous admin's organization selection must not leak into this session.
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_ORG_COOKIE);

  const next = String(formData.get("next") ?? "");
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  revalidatePath("/", "layout");
  redirect(target);
}

/** Sign out and return to the login screen. */
export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_ORG_COOKIE);

  revalidatePath("/", "layout");
  redirect("/login");
}
