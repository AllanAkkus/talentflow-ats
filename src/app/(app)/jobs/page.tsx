import { Briefcase, MapPin, Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { NoOrganization } from "@/components/layout/no-organization";
import { LinkButton } from "@/components/ui/button";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import {
  EMPLOYMENT_TYPE_LABELS,
  JOB_STATUS_LABELS,
  JOB_STATUS_STYLES,
} from "@/lib/constants";
import { listJobs } from "@/lib/data/ats";
import { requireWorkspace } from "@/lib/permissions/workspace";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Jobs" };

export default async function JobsPage() {
  const workspace = await requireWorkspace();

  if (!workspace.organizationId) {
    return (
      <>
        <PageHeader title="Jobs" description="Roles this organization is recruiting for." />
        <NoOrganization isAdmin={workspace.isAdmin} />
      </>
    );
  }

  const jobs = await listJobs(workspace.organizationId);

  return (
    <>
      <PageHeader
        title="Jobs"
        description={`${jobs.length} role${jobs.length === 1 ? "" : "s"} at ${workspace.organization?.name ?? "this organization"}.`}
        actions={
          <LinkButton href="/jobs/new" variant="primary">
            <Plus className="size-4" />
            New job
          </LinkButton>
        }
      />

      <Card>
        {jobs.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="size-5" />}
            title="No jobs yet"
            description="Create the first role you are recruiting for. Candidates are then assigned to it as applications."
            actionLabel="Create job"
            actionHref="/jobs/new"
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {job.title}
                      </p>
                      <Badge className={JOB_STATUS_STYLES[job.status]}>
                        {JOB_STATUS_LABELS[job.status]}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      {job.location ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" />
                          {job.location}
                        </span>
                      ) : null}
                      {job.employment_type ? (
                        <span>{EMPLOYMENT_TYPE_LABELS[job.employment_type]}</span>
                      ) : null}
                      <span>Created {formatDate(job.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-600">
                    <Users className="size-3.5 text-slate-400" />
                    {job.applicationCount} candidate
                    {job.applicationCount === 1 ? "" : "s"}
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
