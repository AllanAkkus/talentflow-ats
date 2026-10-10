"use client";

import {
  Briefcase,
  Building2,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { logoutAction } from "@/app/login/actions";
import { Logo } from "@/components/layout/logo";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const WORKSPACE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/users", label: "Users", icon: UsersRound },
];

/**
 * Sidebar + topbar frame for every authenticated page.
 *
 * Desktop gets a fixed sidebar; on small screens it becomes a slide-over
 * drawer. The organization switcher lives in the topbar so the active tenant is
 * always on screen - the single most important piece of context for an admin
 * acting on a customer's behalf.
 */
export function AppShell({
  role,
  fullName,
  email,
  orgSwitcher,
  children,
}: {
  role: UserRole;
  fullName: string;
  email: string;
  orgSwitcher: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = role === "admin";

  // Closing the drawer on the link click itself (rather than reacting to a
  // pathname change in an effect) avoids an extra render pass and still closes
  // when the user taps the link they are already on.
  const closeDrawer = () => setMobileOpen(false);

  const nav = (
    <nav className="flex flex-1 flex-col gap-6 px-3 py-4" aria-label="Main">
      <NavSection
        items={WORKSPACE_NAV}
        pathname={pathname}
        onNavigate={closeDrawer}
      />
      {isAdmin ? (
        <NavSection
          items={ADMIN_NAV}
          pathname={pathname}
          title="Platform admin"
          onNavigate={closeDrawer}
        />
      ) : null}
    </nav>
  );

  const userBlock = (
    <div className="border-t border-slate-200 p-3">
      <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
        <Avatar name={fullName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-900">
            {fullName}
          </p>
          <p className="truncate text-[11px] text-slate-500">{email}</p>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 px-2">
        {isAdmin ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
            <ShieldCheck className="size-3" />
            Platform admin
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
            Customer
          </span>
        )}
        <form action={logoutAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-full flex-1">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-14 items-center border-b border-slate-200 px-4">
          <Link href="/dashboard" className="rounded-md">
            <Logo />
          </Link>
        </div>
        {nav}
        {userBlock}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex h-full w-64 flex-col bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
              <Logo />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>
            {nav}
            {userBlock}
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          <div className="lg:hidden">
            <Logo compact />
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            {orgSwitcher}
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function NavSection({
  items,
  pathname,
  title,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  title?: string;
  onNavigate: () => void;
}) {
  return (
    <div>
      {title ? (
        <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </p>
      ) : null}
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <Icon
                  className={cn(
                    "size-4",
                    active ? "text-indigo-600" : "text-slate-400",
                  )}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
