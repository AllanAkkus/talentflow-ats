import Link from "next/link";

import { Logo } from "@/components/layout/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <Logo />
      <h1 className="text-lg font-semibold text-slate-900">Page not found</h1>
      <p className="max-w-sm text-sm text-slate-600">
        The page you were looking for does not exist.
      </p>
      <Link
        href="/"
        className="inline-flex h-9 items-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Go to TalentFlow
      </Link>
    </main>
  );
}
