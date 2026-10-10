import type { Metadata } from "next";

import { CandidateForm } from "@/components/candidates/candidate-form";
import { NoOrganization } from "@/components/layout/no-organization";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requireWorkspace } from "@/lib/permissions/workspace";

export const metadata: Metadata = { title: "Add candidate" };

export default async function NewCandidatePage() {
  const workspace = await requireWorkspace();

  if (!workspace.organizationId) {
    return (
      <>
        <PageHeader title="Add candidate" />
        <NoOrganization isAdmin={workspace.isAdmin} />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Add candidate"
        description={`Adding to ${workspace.organization?.name ?? "this organization"}'s talent pool.`}
      />
      <Card className="p-5">
        <CandidateForm />
      </Card>
    </div>
  );
}
