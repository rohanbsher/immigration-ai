import {
  StatsCardSkeleton,
  PageHeaderSkeleton,
  ListSkeleton,
  CaseCardSkeleton,
} from '@/components/ui/skeletons';

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
      </div>
      <ListSkeleton count={3} ItemSkeleton={CaseCardSkeleton} />
    </div>
  );
}
