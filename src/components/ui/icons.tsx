import { cn } from "@/lib/utils";

/**
 * lucide-react v1 dropped brand marks, so the LinkedIn glyph is inline here.
 * Kept tiny and `currentColor`-driven so it behaves like any lucide icon.
 */
export function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("size-4", className)}
    >
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm6.5 0H13v1.7h.05c.5-.9 1.7-1.9 3.5-1.9 2.8 0 3.95 1.8 3.95 4.95V21h-4v-6.3c0-1.5-.5-2.5-1.85-2.5-1.1 0-1.75.75-2.05 1.5-.1.25-.15.6-.15.95V21h-4V9Z" />
    </svg>
  );
}
