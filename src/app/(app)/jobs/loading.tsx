import {
  ListSkeleton,
  PageHeaderSkeleton,
} from "@/components/ui/loading-skeletons";

export default function JobsLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <ListSkeleton />
    </>
  );
}
