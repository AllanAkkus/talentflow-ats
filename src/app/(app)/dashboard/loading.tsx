import {
  PageHeaderSkeleton,
  StatsSkeleton,
} from "@/components/ui/loading-skeletons";
import { Card, Skeleton } from "@/components/ui/primitives";

export default function DashboardLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <StatsSkeleton />
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <Card key={index} className="p-5">
            <Skeleton className="h-4 w-32" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }, (_, row) => (
                <Skeleton key={row} className="h-10 w-full" />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
