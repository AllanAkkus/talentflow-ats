import {
  ListSkeleton,
  PageHeaderSkeleton,
} from "@/components/ui/loading-skeletons";

export default function JobDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeaderSkeleton />
      <ListSkeleton rows={4} />
    </div>
  );
}
