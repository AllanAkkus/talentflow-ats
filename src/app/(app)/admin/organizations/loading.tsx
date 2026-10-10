import {
  ListSkeleton,
  PageHeaderSkeleton,
} from "@/components/ui/loading-skeletons";

export default function AdminOrganizationsLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <ListSkeleton rows={3} />
    </>
  );
}
