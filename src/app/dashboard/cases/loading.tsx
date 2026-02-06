import {
  Skeleton,
  PageHeaderSkeleton,
  ListSkeleton,
  CaseCardSkeleton,
} from '@/components/ui/skeletons';

export default function CasesLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-24 rounded-md" />
        <Skeleton className="h-10 w-24 rounded-md" />
        <Skeleton className="h-10 w-24 rounded-md" />
      </div>
      <ListSkeleton count={5} ItemSkeleton={CaseCardSkeleton} />
    </div>
  );
}
