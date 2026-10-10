import { Briefcase, MapPin, Plus, Users } from "lucide-react";
import { LinkedInIcon } from "@/components/ui/icons";
import type { Metadata } from "next";
import Link from "next/link";

import { CandidateSearch } from "@/components/candidates/candidate-search";
import { NoOrganization } from "@/components/layout/no-organization";
import { Avatar } from "@/components/ui/avatar";
import { LinkButton } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { listCandidates } from "@/lib/data/ats";
import { requireWorkspace } from "@/lib/permissions/workspace";

export const metadata: Metadata = { title: "Candidates" };

export default async function CandidatesPage(
  props: PageProps<"/candidates">,
) {
  const searchParams = await props.searchParams;
  const rawQuery = searchParams.q;
  const query = typeof rawQuery === "string" ? rawQuery : "";

  const workspace = await requireWorkspace();

  if (!workspace.organizationId) {
    return (
      <>
        <PageHeader title="Candidates" description="This organization's talent pool." />
        <NoOrganization isAdmin={workspace.isAdmin} />
      </>
    );
  }

  const candidates = await listCandidates(workspace.organizationId, query);

  return (
    <>
      <PageHeader
        title="Candidates"
        description={`Talent pool for ${workspace.organization?.name ?? "this organization"}.`}
        actions={
          <>
            <CandidateSearch initialQuery={query} />
            <LinkButton href="/candidates/new" variant="primary">
              <Plus className="size-4" />
              Add candidate
            </LinkButton>
          </>
        }
      />

      <Card>
        {candidates.length === 0 ? (
          query ? (
            <EmptyState
              icon={<Users className="size-5" />}
              title={`No candidates match “${query}”`}
              description="Try a shorter search term, or clear the search to see everyone."
            />
          ) : (
            <EmptyState
              icon={<Users className="size-5" />}
              title="No candidates yet"
              description="Add the first candidate. You can then assign them to one or more jobs, which creates their applications."
              actionLabel="Add candidate"
              actionHref="/candidates/new"
            />
          )
        ) : (
          <ul className="divide-y divide-slate-100">
            {candidates.map((candidate) => (
              <li key={candidate.id}>
                <Link
                  href={`/candidates/${candidate.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50"
                >
                  <Avatar name={candidate.full_name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {candidate.full_name}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      {candidate.email ? (
                        <span className="truncate">{candidate.email}</span>
                      ) : null}
                      {candidate.location ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" />
                          {candidate.location}
                        </span>
                      ) : null}
                      {candidate.linkedin_url ? (
                        <span className="inline-flex items-center gap-1 text-sky-700">
                          <LinkedInIcon className="size-3" />
                          LinkedIn
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-600">
                    <Briefcase className="size-3.5 text-slate-400" />
                    {candidate.applicationCount} job
                    {candidate.applicationCount === 1 ? "" : "s"}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
