import {
  BoardSkeleton,
  PageHeaderSkeleton,
} from "@/components/ui/loading-skeletons";

export default function PipelineLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <BoardSkeleton />
    </>
  );
}
