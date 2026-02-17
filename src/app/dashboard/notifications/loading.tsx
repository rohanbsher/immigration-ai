import {
  Skeleton,
  NotificationSkeleton,
  ListSkeleton,
} from '@/components/ui/skeletons';

export default function NotificationsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      {/* Section label */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        <ListSkeleton count={4} ItemSkeleton={NotificationSkeleton} />
      </div>
    </div>
  );
}
