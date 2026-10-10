"use client";

import { Building2, ChevronDown } from "lucide-react";
import { useRef, useTransition } from "react";

import { setActiveOrganizationAction } from "@/app/(app)/actions";
import { Spinner } from "@/components/ui/primitives";
import type { Organization } from "@/types/database";

/**
 * Organization context control.
 *
 * For a platform admin this is a live switcher: picking an organization sets a
 * cookie and re-renders the whole app as that tenant's ATS manager. For a
 * customer there is nothing to switch, so it renders as a static label.
 */
export function OrgSwitcher({
  organizations,
  activeOrganizationId,
  canSwitch,
  activeOrganizationName,
}: {
  organizations: Organization[];
  activeOrganizationId: string | null;
  canSwitch: boolean;
  activeOrganizationName: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  if (!canSwitch) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
        <Building2 className="size-4 text-slate-400" />
        <span className="truncate">{activeOrganizationName ?? "No organization"}</span>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
        <Building2 className="size-4" />
        No organizations yet
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={(formData) => {
        startTransition(async () => {
          await setActiveOrganizationAction(formData);
        });
      }}
      className="flex items-center gap-2"
    >
      <label
        htmlFor="active-organization"
        className="hidden text-xs font-medium text-slate-500 sm:block"
      >
        Viewing organization
      </label>
      <div className="relative">
        <Building2 className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-indigo-500" />
        <select
          id="active-organization"
          name="organizationId"
          defaultValue={activeOrganizationId ?? ""}
          onChange={() => formRef.current?.requestSubmit()}
          disabled={isPending}
          className="h-9 min-w-52 max-w-72 appearance-none truncate rounded-lg bg-indigo-50 pl-8.5 pr-8 text-sm font-medium text-indigo-900 ring-1 ring-indigo-200 focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
        >
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-indigo-500">
          {isPending ? <Spinner className="size-3.5" /> : <ChevronDown className="size-4" />}
        </span>
      </div>
    </form>
  );
}
