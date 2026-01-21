'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Upload, Loader2 } from 'lucide-react';
import { useCases } from '@/hooks/use-cases';

export default function DocumentsPage() {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const { data: casesData, isLoading: casesLoading } = useCases({}, { limit: 100 });

  if (casesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
          <p className="text-slate-600">View and manage all case documents</p>
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
                      (window.location.href = `/dashboard/cases/${caseItem.id}?tab=documents`)
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
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No cases yet
            </h3>
            <p className="text-slate-600 mb-4">
              Create a case first to start uploading documents.
            </p>
            <Button onClick={() => (window.location.href = '/dashboard/cases')}>
              Go to Cases
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
