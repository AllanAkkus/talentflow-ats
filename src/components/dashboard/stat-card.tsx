import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * One metric tile. Rendered as a link when there is a sensible place to drill
 * into, otherwise as a plain card.
 */
export function StatCard({
  label,
  value,
  icon,
  href,
  accentClassName,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  href?: string;
  accentClassName?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-lg",
            accentClassName ?? "bg-slate-100 text-slate-500",
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
    </>
  );

  const className =
    "block rounded-xl bg-white p-4 ring-1 ring-slate-200/80 shadow-xs transition-colors";

  if (href) {
    return (
      <Link href={href} className={cn(className, "hover:ring-indigo-300")}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}
