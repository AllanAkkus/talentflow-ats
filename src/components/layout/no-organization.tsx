import { Building2 } from "lucide-react";

import { Card, EmptyState } from "@/components/ui/primitives";

/**
 * Shown when there is no active tenant to render:
 *  - a platform admin before any organization exists, or
 *  - a customer whose profile somehow has no organization.
 */
export function NoOrganization({ isAdmin }: { isAdmin: boolean }) {
  return (
    <Card>
      <EmptyState
        icon={<Building2 className="size-5" />}
        title={isAdmin ? "No organization selected" : "No organization linked"}
        description={
          isAdmin
            ? "Create a customer organization to start adding jobs, candidates and pipelines on their behalf."
            : "Your account is not linked to an organization yet. Ask your TalentFlow administrator to finish the setup."
        }
        actionLabel={isAdmin ? "Go to Organizations" : undefined}
        actionHref={isAdmin ? "/admin/organizations" : undefined}
      />
    </Card>
  );
}
