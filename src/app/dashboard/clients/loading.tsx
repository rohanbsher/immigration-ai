import {
  PageHeaderSkeleton,
  StatsCardSkeleton,
  ClientCardSkeleton,
  GridSkeleton,
  Skeleton,
} from '@/components/ui/skeletons';
import { Card, CardContent } from '@/components/ui/card';

export default function ClientsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <PageHeaderSkeleton />
        <Skeleton className="h-10 w-40" />
      </div>
      {/* Search bar skeleton */}
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
      {/* Stats row */}
      <GridSkeleton count={3} ItemSkeleton={StatsCardSkeleton} columns={3} />
      {/* Client card grid */}
      <GridSkeleton count={6} ItemSkeleton={ClientCardSkeleton} columns={3} />
    </div>
  );
}
