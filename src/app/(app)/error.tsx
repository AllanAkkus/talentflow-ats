"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";

/**
 * Error boundary for every authenticated page. Shows something useful instead
 * of a blank screen, and keeps the real stack in the server logs rather than on
 * the page. A missing Supabase configuration is the most likely cause in a
 * fresh environment, so it gets a hint of its own.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[TalentFlow]", error);
  }, [error]);

  const looksLikeConfig = /Missing environment variable/i.test(error.message);

  return (
    <div className="mx-auto max-w-xl py-10">
      <Card className="p-6 text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <AlertTriangle className="size-5" />
        </div>
        <h1 className="text-base font-semibold text-slate-900">
          Something went wrong
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">
          {looksLikeConfig
            ? "TalentFlow is not fully configured in this environment. Check the Supabase environment variables."
            : "The page could not be loaded. This has been logged."}
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-slate-400">
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="mt-5 flex items-center justify-center gap-2">
          <Button onClick={reset}>
            <RotateCcw className="size-4" />
            Try again
          </Button>
          <LinkButton href="/dashboard">Back to dashboard</LinkButton>
        </div>
      </Card>
    </div>
  );
}
