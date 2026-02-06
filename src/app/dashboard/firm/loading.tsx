import {
  Skeleton,
  PageHeaderSkeleton,
  ListSkeleton,
  ClientCardSkeleton,
} from '@/components/ui/skeletons';
import { Card, CardContent } from '@/components/ui/card';

export default function FirmLoading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <Card>
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-48" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-48" />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        <ListSkeleton count={3} ItemSkeleton={ClientCardSkeleton} />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <ListSkeleton count={2} ItemSkeleton={ClientCardSkeleton} />
      </div>
    </div>
  );
}
