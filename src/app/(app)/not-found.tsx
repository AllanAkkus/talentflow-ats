import { SearchX } from "lucide-react";

import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";

export default function AppNotFound() {
  return (
    <div className="mx-auto max-w-xl py-10">
      <Card className="p-6 text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <SearchX className="size-5" />
        </div>
        <h1 className="text-base font-semibold text-slate-900">Not found</h1>
        <p className="mt-1.5 text-sm text-slate-600">
          This record does not exist, or it belongs to another organization.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <LinkButton href="/jobs">Jobs</LinkButton>
          <LinkButton href="/candidates">Candidates</LinkButton>
          <LinkButton href="/dashboard" variant="primary">
            Dashboard
          </LinkButton>
        </div>
      </Card>
    </div>
  );
}
