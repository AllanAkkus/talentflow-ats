import {
  ListSkeleton,
  PageHeaderSkeleton,
} from "@/components/ui/loading-skeletons";

export default function CandidateDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeaderSkeleton />
      <ListSkeleton rows={3} />
    </div>
  );
}
