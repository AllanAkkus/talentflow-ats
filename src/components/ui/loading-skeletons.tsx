import { Card, Skeleton } from "@/components/ui/primitives";

/**
 * Route-level loading placeholders. Used by the `loading.tsx` files so a
 * navigation shows structure immediately instead of a blank page while the
 * server component awaits Supabase.
 */

export function PageHeaderSkeleton() {
  return (
    <div className="mb-6 space-y-2">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-72" />
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card>
      <ul className="divide-y divide-slate-100">
        {Array.from({ length: rows }, (_, index) => (
          <li key={index} className="flex items-center gap-3 px-5 py-4">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-3 w-20" />
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="rounded-xl bg-white p-4 ring-1 ring-slate-200/80"
        >
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-7 w-10" />
        </div>
      ))}
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 5 }, (_, column) => (
        <div key={column} className="w-72 shrink-0">
          <Skeleton className="mb-2 h-3 w-24" />
          <div className="space-y-2 rounded-xl bg-slate-100/70 p-2">
            {Array.from({ length: 3 - (column % 2) }, (_, card) => (
              <div
                key={card}
                className="space-y-2 rounded-lg bg-white p-2.5 ring-1 ring-slate-200"
              >
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-7 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <Card className="space-y-5 p-5">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </Card>
  );
}
