import {
  Skeleton,
  PageHeaderSkeleton,
  ListSkeleton,
  DocumentCardSkeleton,
} from '@/components/ui/skeletons';

export default function DocumentsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 w-20 rounded-md" />
        <Skeleton className="h-10 w-20 rounded-md" />
        <Skeleton className="h-10 w-20 rounded-md" />
      </div>
      <ListSkeleton count={5} ItemSkeleton={DocumentCardSkeleton} />
    </div>
  );
}
