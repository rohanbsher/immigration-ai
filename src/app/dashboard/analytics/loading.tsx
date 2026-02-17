import {
  PageHeaderSkeleton,
  StatsCardSkeleton,
  GridSkeleton,
  Skeleton,
} from '@/components/ui/skeletons';

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      {/* KPI cards row */}
      <GridSkeleton count={4} ItemSkeleton={StatsCardSkeleton} columns={4} />
      {/* Two chart areas side by side */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
      {/* Recent activity table */}
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}
