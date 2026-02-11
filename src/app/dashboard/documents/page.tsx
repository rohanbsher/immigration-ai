'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText } from 'lucide-react';
import { useCases } from '@/hooks/use-cases';
import { DocumentsEmptyState } from '@/components/ui/empty-state';
import { Skeleton, StatsCardSkeleton } from '@/components/ui/skeletons';

export default function DocumentsPage() {
  const router = useRouter();
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const { data: casesData, isLoading: casesLoading } = useCases({}, { limit: 100 });

  if (casesLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        {/* Content skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-32 rounded-md" />
              ))}
            </div>
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <StatsCardSkeleton key={i} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documents</h1>
          <p className="text-muted-foreground">View and manage all case documents</p>
        </div>
      </div>

      {/* Content */}
      {casesData?.cases && casesData.cases.length > 0 ? (
        <Tabs
          value={selectedCaseId || casesData.cases[0]?.id}
          onValueChange={setSelectedCaseId}
        >
          <Card>
            <CardHeader>
              <CardTitle>Select a Case</CardTitle>
            </CardHeader>
            <CardContent>
              <TabsList className="flex-wrap h-auto gap-2">
                {casesData.cases.map((caseItem) => (
                  <TabsTrigger key={caseItem.id} value={caseItem.id}>
                    {caseItem.client.first_name} {caseItem.client.last_name} -{' '}
                    {caseItem.visa_type}
                  </TabsTrigger>
                ))}
              </TabsList>
            </CardContent>
          </Card>

          {casesData.cases.map((caseItem) => (
            <TabsContent key={caseItem.id} value={caseItem.id} className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>
                    Documents for {caseItem.client.first_name}{' '}
                    {caseItem.client.last_name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 mb-4">
                    Case: {caseItem.title} ({caseItem.visa_type})
                  </p>
                  <Button
                    variant="outline"
                    onClick={() =>
                      router.push(`/dashboard/cases/${caseItem.id}?tab=documents`)
                    }
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    View Documents in Case
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <Card>
          <CardContent className="p-6">
            <DocumentsEmptyState />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
