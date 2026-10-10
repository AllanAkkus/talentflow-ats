import type { Metadata } from "next";

import { NoOrganization } from "@/components/layout/no-organization";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { PageHeader } from "@/components/ui/primitives";
import { listBoardApplications, listJobOptions } from "@/lib/data/ats";
import { requireWorkspace } from "@/lib/permissions/workspace";

export const metadata: Metadata = { title: "Pipeline" };

/**
 * The Kanban board.
 *
 * All of the organization's applications are loaded once on the server and then
 * filtered in the browser, which is what makes the job filter and name search
 * feel instant. The data is already tenant-scoped by the query and by RLS, so
 * client-side filtering is a UX choice here, never a security control.
 */
export default async function PipelinePage() {
  const workspace = await requireWorkspace();

  if (!workspace.organizationId) {
    return (
      <>
        <PageHeader title="Pipeline" description="Candidates by recruitment stage." />
        <NoOrganization isAdmin={workspace.isAdmin} />
      </>
    );
  }

  const [applications, jobs] = await Promise.all([
    listBoardApplications(workspace.organizationId),
    listJobOptions(workspace.organizationId),
  ]);

  return (
    <>
      <PageHeader
        title="Pipeline"
        description={`${applications.length} application${applications.length === 1 ? "" : "s"} across ${jobs.length} job${jobs.length === 1 ? "" : "s"} at ${workspace.organization?.name ?? "this organization"}.`}
      />
      <PipelineBoard applications={applications} jobs={jobs} />
    </>
  );
}
