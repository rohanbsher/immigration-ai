import { PageHeaderSkeleton, Skeleton } from '@/components/ui/skeletons';

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      {/* Tab bar skeleton */}
      <div className="flex gap-4">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-10 w-20" />
      </div>
      {/* Card skeletons matching profile tab layout */}
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  );
}
