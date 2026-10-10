import { AppShell } from "@/components/layout/app-shell";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { requireSessionContext } from "@/lib/auth/session";
import { requireWorkspace } from "@/lib/permissions/workspace";

/**
 * Authenticated layout. Every page in this route group is behind this guard, so
 * a page that forgets its own check is still not reachable anonymously. (The
 * database RLS policies are the real boundary; this is the UX layer.)
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireSessionContext();
  const workspace = await requireWorkspace();

  return (
    <AppShell
      role={workspace.session.profile.role}
      fullName={workspace.session.profile.full_name}
      email={workspace.session.email}
      orgSwitcher={
        <OrgSwitcher
          organizations={workspace.organizations}
          activeOrganizationId={workspace.organizationId}
          canSwitch={workspace.isAdmin}
          activeOrganizationName={workspace.organization?.name ?? null}
        />
      }
    >
      {children}
    </AppShell>
  );
}
