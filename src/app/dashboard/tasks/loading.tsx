import { PageHeaderSkeleton, Skeleton } from '@/components/ui/skeletons';

export default function TasksLoading() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeaderSkeleton />
      {/* Filter/toolbar skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-32 rounded-md" />
        <Skeleton className="h-10 w-32 rounded-md" />
        <Skeleton className="h-10 w-24 rounded-md" />
      </div>
      {/* Task list items */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
