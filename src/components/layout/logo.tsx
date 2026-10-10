import { cn } from "@/lib/utils";

/** TalentFlow wordmark. The glyph is inline SVG so there is no asset to load. */
export function Logo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 shadow-sm">
        <svg
          viewBox="0 0 24 24"
          className="size-4.5 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 7h16" />
          <path d="M4 12h10" />
          <path d="M4 17h6" />
          <circle cx="18.5" cy="16.5" r="3" />
        </svg>
      </span>
      {compact ? null : (
        <span className="text-base font-semibold tracking-tight text-slate-900">
          TalentFlow
        </span>
      )}
    </span>
  );
}
