import type { Metadata } from "next";

import { JobForm } from "@/components/jobs/job-form";
import { NoOrganization } from "@/components/layout/no-organization";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requireWorkspace } from "@/lib/permissions/workspace";

export const metadata: Metadata = { title: "New job" };

export default async function NewJobPage() {
  const workspace = await requireWorkspace();

  if (!workspace.organizationId) {
    return (
      <>
        <PageHeader title="New job" />
        <NoOrganization isAdmin={workspace.isAdmin} />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New job"
        description={`Creating a role for ${workspace.organization?.name ?? "this organization"}.`}
      />
      <Card className="p-5">
        <JobForm />
      </Card>
    </div>
  );
}
