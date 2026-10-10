import { Briefcase, Building2, KanbanSquare, Users } from "lucide-react";
import type { Metadata } from "next";

import { setActiveOrganizationAction } from "@/app/(app)/actions";
import { CreateOrganizationDialog } from "@/components/admin/create-organization-dialog";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { requireAdminContext } from "@/lib/auth/session";
import { listOrganizationOverview } from "@/lib/data/admin";
import { requireWorkspace } from "@/lib/permissions/workspace";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Organizations" };

/**
 * Platform-admin view of every tenant, with a "View as" switch that makes the
 * rest of the app operate as that organization's ATS manager.
 */
export default async function AdminOrganizationsPage() {
  await requireAdminContext();
  const workspace = await requireWorkspace();
  const organizations = await listOrganizationOverview();

  return (
    <>
      <PageHeader
        title="Organizations"
        description="Every customer tenant on the platform. Each one is fully isolated from the others."
        actions={<CreateOrganizationDialog />}
      />

      <Card>
        {organizations.length === 0 ? (
          <EmptyState
            icon={<Building2 className="size-5" />}
            title="No organizations yet"
            description="Create the first customer organization. You can then create their users, jobs and candidates on their behalf."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {organizations.map((organization) => {
              const isActive = organization.id === workspace.organizationId;
              return (
                <li
                  key={organization.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {organization.name}
                      </p>
                      {isActive ? (
                        <Badge className="bg-indigo-50 text-indigo-700 ring-indigo-200">
                          Viewing
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" />
                        {organization.userCount} user
                        {organization.userCount === 1 ? "" : "s"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Briefcase className="size-3" />
                        {organization.jobCount} job
                        {organization.jobCount === 1 ? "" : "s"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" />
                        {organization.candidateCount} candidate
                        {organization.candidateCount === 1 ? "" : "s"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <KanbanSquare className="size-3" />
                        {organization.applicationCount} application
                        {organization.applicationCount === 1 ? "" : "s"}
                      </span>
                      <span>Created {formatDate(organization.created_at)}</span>
                    </div>
                  </div>

                  <form action={setActiveOrganizationAction} className="shrink-0">
                    <input
                      type="hidden"
                      name="organizationId"
                      value={organization.id}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant={isActive ? "secondary" : "primary"}
                      disabled={isActive}
                    >
                      {isActive ? "Currently viewing" : "View as"}
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <p className="mt-4 text-xs text-slate-500">
        Tenant isolation is enforced by PostgreSQL Row Level Security, not by
        this UI. A customer user signing in only ever receives rows where{" "}
        <code className="rounded bg-slate-100 px-1">organization_id</code>{" "}
        matches their own profile.
      </p>
    </>
  );
}
