import { Skeleton, StatsCardSkeleton, GridSkeleton, CaseCardSkeleton, ListSkeleton } from '@/components/ui/skeletons';

export default function ClientDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header: back button + avatar + name */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-md" />
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-20 rounded-md" />
      </div>
      {/* Stats row */}
      <GridSkeleton count={3} ItemSkeleton={StatsCardSkeleton} columns={3} />
      {/* Tab bar */}
      <div className="flex gap-4">
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-10 w-20" />
      </div>
      {/* Cases list */}
      <ListSkeleton count={3} ItemSkeleton={CaseCardSkeleton} />
    </div>
  );
}
