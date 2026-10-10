import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JobForm } from "@/components/jobs/job-form";
import { NoOrganization } from "@/components/layout/no-organization";
import { Card, PageHeader } from "@/components/ui/primitives";
import { getJob } from "@/lib/data/ats";
import { requireWorkspace } from "@/lib/permissions/workspace";

export const metadata: Metadata = { title: "Edit job" };

export default async function EditJobPage(
  props: PageProps<"/jobs/[id]/edit">,
) {
  const { id } = await props.params;
  const workspace = await requireWorkspace();

  if (!workspace.organizationId) {
    return (
      <>
        <PageHeader title="Edit job" />
        <NoOrganization isAdmin={workspace.isAdmin} />
      </>
    );
  }

  // Scoped to the active organization, so an id from another tenant 404s rather
  // than leaking the fact that it exists.
  const job = await getJob(workspace.organizationId, id);
  if (!job) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit job" description={job.title} />
      <Card className="p-5">
        <JobForm job={job} />
      </Card>
    </div>
  );
}
