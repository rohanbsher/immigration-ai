import { PageHeaderSkeleton, FormCardSkeleton } from '@/components/ui/skeletons';

export default function FormsLoading() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeaderSkeleton />
      {/* Form cards grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <FormCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
