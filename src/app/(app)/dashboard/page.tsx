import {
  Award,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  Filter,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { StatCard } from "@/components/dashboard/stat-card";
import { NoOrganization } from "@/components/layout/no-organization";
import { Avatar } from "@/components/ui/avatar";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { JOB_STATUS_LABELS, JOB_STATUS_STYLES } from "@/lib/constants";
import {
  getDashboardStats,
  listRecentCandidates,
  listRecentJobs,
} from "@/lib/data/ats";
import { requireWorkspace } from "@/lib/permissions/workspace";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const workspace = await requireWorkspace();

  if (!workspace.organizationId) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          description="Pipeline overview for the active organization."
        />
        <NoOrganization isAdmin={workspace.isAdmin} />
      </>
    );
  }

  const organizationId = workspace.organizationId;
  const [stats, recentJobs, recentCandidates] = await Promise.all([
    getDashboardStats(organizationId),
    listRecentJobs(organizationId),
    listRecentCandidates(organizationId),
  ]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Pipeline overview for ${workspace.organization?.name ?? "this organization"}.`}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Open jobs"
          value={stats.openJobs}
          href="/jobs"
          icon={<Briefcase className="size-4" />}
          accentClassName="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          label="Candidates"
          value={stats.candidates}
          href="/candidates"
          icon={<Users className="size-4" />}
          accentClassName="bg-sky-50 text-sky-600"
        />
        <StatCard
          label="Screening"
          value={stats.byStage.screening}
          href="/pipeline"
          icon={<Filter className="size-4" />}
          accentClassName="bg-sky-50 text-sky-600"
        />
        <StatCard
          label="Interviews"
          value={stats.byStage.interview}
          href="/pipeline"
          icon={<CalendarCheck className="size-4" />}
          accentClassName="bg-violet-50 text-violet-600"
        />
        <StatCard
          label="Offers"
          value={stats.byStage.offer}
          href="/pipeline"
          icon={<Award className="size-4" />}
          accentClassName="bg-amber-50 text-amber-600"
        />
        <StatCard
          label="Hired"
          value={stats.byStage.hired}
          href="/pipeline"
          icon={<CheckCircle2 className="size-4" />}
          accentClassName="bg-emerald-50 text-emerald-600"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent jobs"
            description={`${stats.totalJobs} job${stats.totalJobs === 1 ? "" : "s"} in total`}
            action={
              <Link
                href="/jobs"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                View all
              </Link>
            }
          />
          {recentJobs.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="size-5" />}
              title="No jobs yet"
              description="Create the first role this organization is recruiting for."
              actionLabel="Create job"
              actionHref="/jobs/new"
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentJobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {job.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {job.location ?? "Location not set"} ·{" "}
                        {formatDate(job.created_at)}
                      </p>
                    </div>
                    <Badge className={JOB_STATUS_STYLES[job.status]}>
                      {JOB_STATUS_LABELS[job.status]}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent candidates"
            description={`${stats.candidates} candidate${stats.candidates === 1 ? "" : "s"} in the talent pool`}
            action={
              <Link
                href="/candidates"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                View all
              </Link>
            }
          />
          {recentCandidates.length === 0 ? (
            <EmptyState
              icon={<Users className="size-5" />}
              title="No candidates yet"
              description="Add a candidate to start building this organization's pipeline."
              actionLabel="Add candidate"
              actionHref="/candidates/new"
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentCandidates.map((candidate) => (
                <li key={candidate.id}>
                  <Link
                    href={`/candidates/${candidate.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50"
                  >
                    <Avatar name={candidate.full_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {candidate.full_name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {candidate.email ?? candidate.location ?? "No contact details"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">
                      {formatDate(candidate.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
