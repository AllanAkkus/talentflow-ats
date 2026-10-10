import type { Metadata } from "next";

import { LoginForm } from "@/app/login/login-form";
import { Logo } from "@/components/layout/logo";

export const metadata: Metadata = {
  title: "Sign in",
};

/**
 * The only unauthenticated screen in the product. There is no public signup -
 * accounts are created by a platform admin (see /admin/users).
 */
export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const nextParam = searchParams.next;
  const next = typeof nextParam === "string" ? nextParam : undefined;

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo />
          <h1 className="mt-6 text-xl font-semibold tracking-tight text-slate-900">
            Sign in to TalentFlow
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Applicant tracking for small recruitment teams.
          </p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <LoginForm next={next} />
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Accounts are created by your TalentFlow administrator. There is no
          public signup.
        </p>
      </div>
    </main>
  );
}
