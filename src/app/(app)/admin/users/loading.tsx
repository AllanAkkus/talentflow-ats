import {
  ListSkeleton,
  PageHeaderSkeleton,
} from "@/components/ui/loading-skeletons";

export default function AdminUsersLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <ListSkeleton rows={4} />
    </>
  );
}
