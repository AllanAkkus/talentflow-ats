import { ShieldCheck, UsersRound } from "lucide-react";
import type { Metadata } from "next";

import { CreateUserDialog } from "@/components/admin/create-user-dialog";
import { Avatar } from "@/components/ui/avatar";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { requireAdminContext } from "@/lib/auth/session";
import { listPlatformUsers } from "@/lib/data/admin";
import { requireWorkspace } from "@/lib/permissions/workspace";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage() {
  await requireAdminContext();
  const workspace = await requireWorkspace();
  const users = await listPlatformUsers();

  const admins = users.filter((user) => user.role === "admin");
  const customers = users.filter((user) => user.role === "customer");

  return (
    <>
      <PageHeader
        title="Users"
        description={`${admins.length} platform admin${admins.length === 1 ? "" : "s"} and ${customers.length} customer user${customers.length === 1 ? "" : "s"}. There is no public signup - accounts are created here.`}
        actions={<CreateUserDialog organizations={workspace.organizations} />}
      />

      <Card>
        {users.length === 0 ? (
          <EmptyState
            icon={<UsersRound className="size-5" />}
            title="No users yet"
            description="Create the first account."
          />
        ) : (
          <div className="overflow-x-auto tf-scroll">
            <table className="w-full min-w-3xl text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Name
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Email
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Role
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Organization
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Last sign-in
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={user.fullName} size="xs" />
                        <span className="font-medium text-slate-900">
                          {user.fullName}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {user.email ?? (
                        <span className="text-slate-400">unknown</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {user.role === "admin" ? (
                        <Badge className="bg-indigo-50 text-indigo-700 ring-indigo-200">
                          <ShieldCheck className="size-3" />
                          Platform admin
                        </Badge>
                      ) : (
                        <Badge>Customer</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {user.organizationName ?? (
                        <span className="text-slate-400">
                          {user.role === "admin" ? "Global" : "-"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {user.lastSignInAt
                        ? formatDate(user.lastSignInAt)
                        : "Never"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 text-xs text-slate-500">
        Accounts are created server-side through{" "}
        <code className="rounded bg-slate-100 px-1">POST /api/admin/users</code>
        , which verifies the caller is a platform admin before using the
        Supabase service-role key. That key is never sent to the browser.
      </p>
    </>
  );
}
