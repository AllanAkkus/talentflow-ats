import { avatarTint, cn, initials } from "@/lib/utils";

/**
 * Initials avatar. No image uploads in the MVP, so a deterministic tint keeps
 * lists scannable without any extra storage.
 */
export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const sizes = {
    xs: "size-6 text-[10px]",
    sm: "size-7 text-[11px]",
    md: "size-9 text-xs",
  } as const;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        sizes[size],
        avatarTint(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
