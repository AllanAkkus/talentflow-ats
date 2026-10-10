import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CandidateForm } from "@/components/candidates/candidate-form";
import { NoOrganization } from "@/components/layout/no-organization";
import { Card, PageHeader } from "@/components/ui/primitives";
import { getCandidate } from "@/lib/data/ats";
import { requireWorkspace } from "@/lib/permissions/workspace";

export const metadata: Metadata = { title: "Edit candidate" };

export default async function EditCandidatePage(
  props: PageProps<"/candidates/[id]/edit">,
) {
  const { id } = await props.params;
  const workspace = await requireWorkspace();

  if (!workspace.organizationId) {
    return (
      <>
        <PageHeader title="Edit candidate" />
        <NoOrganization isAdmin={workspace.isAdmin} />
      </>
    );
  }

  const candidate = await getCandidate(workspace.organizationId, id);
  if (!candidate) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit candidate" description={candidate.full_name} />
      <Card className="p-5">
        <CandidateForm candidate={candidate} />
      </Card>
    </div>
  );
}
