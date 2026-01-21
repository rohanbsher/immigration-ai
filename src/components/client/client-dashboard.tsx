'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FileText, Calendar, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { CaseTimeline } from './case-timeline';

interface ClientCase {
  id: string;
  title: string;
  visaType: string;
  status: string;
  deadline: string | null;
  createdAt: string;
  documentsUploaded: number;
  documentsRequired: number;
  formsCompleted: number;
  formsTotal: number;
}

async function fetchClientCases(): Promise<ClientCase[]> {
  const response = await fetch('/api/cases?role=client');
  if (!response.ok) {
    throw new Error('Failed to fetch cases');
  }
  const data = await response.json();
  return data.data || [];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  intake: { label: 'Intake', color: 'bg-blue-500', icon: Clock },
  document_collection: { label: 'Collecting Documents', color: 'bg-yellow-500', icon: FileText },
  document_review: { label: 'Under Review', color: 'bg-purple-500', icon: FileText },
  form_preparation: { label: 'Preparing Forms', color: 'bg-indigo-500', icon: FileText },
  client_review: { label: 'Needs Your Review', color: 'bg-orange-500', icon: AlertTriangle },
  ready_to_file: { label: 'Ready to File', color: 'bg-green-500', icon: CheckCircle },
  filed: { label: 'Filed', color: 'bg-teal-500', icon: CheckCircle },
  rfe_received: { label: 'RFE Received', color: 'bg-red-500', icon: AlertTriangle },
  approved: { label: 'Approved', color: 'bg-emerald-500', icon: CheckCircle },
  denied: { label: 'Denied', color: 'bg-red-600', icon: AlertTriangle },
  completed: { label: 'Completed', color: 'bg-gray-500', icon: CheckCircle },
  closed: { label: 'Closed', color: 'bg-gray-400', icon: CheckCircle },
};

function getStatusProgress(status: string): number {
  const statusOrder = [
    'intake',
    'document_collection',
    'document_review',
    'form_preparation',
    'client_review',
    'ready_to_file',
    'filed',
    'approved',
    'completed',
  ];
  const index = statusOrder.indexOf(status);
  if (index === -1) return 0;
  return Math.round(((index + 1) / statusOrder.length) * 100);
}

export function ClientDashboard() {
  const { data: cases, isLoading } = useQuery({
    queryKey: ['client-cases'],
    queryFn: fetchClientCases,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">My Cases</h1>
        <div className="grid gap-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 w-48 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-24 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!cases || cases.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">My Cases</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No active cases</h3>
            <p className="text-muted-foreground">
              You don&apos;t have any immigration cases yet.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Cases</h1>
        <p className="text-muted-foreground">
          Track the progress of your immigration cases
        </p>
      </div>

      <div className="grid gap-6">
        {cases.map((caseItem) => {
          const statusConfig = STATUS_CONFIG[caseItem.status] || STATUS_CONFIG.intake;
          const StatusIcon = statusConfig.icon;
          const progress = getStatusProgress(caseItem.status);
          const documentsProgress = caseItem.documentsRequired > 0
            ? Math.round((caseItem.documentsUploaded / caseItem.documentsRequired) * 100)
            : 0;

          return (
            <Card key={caseItem.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">{caseItem.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{caseItem.visaType}</Badge>
                      <Badge className={statusConfig.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    </div>
                  </div>
                  {caseItem.deadline && (
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        Deadline
                      </div>
                      <div className="font-medium">
                        {format(new Date(caseItem.deadline), 'MMM d, yyyy')}
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span>Overall Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <FileText className="h-4 w-4" />
                      Documents
                    </div>
                    <div className="text-2xl font-bold">
                      {caseItem.documentsUploaded} / {caseItem.documentsRequired}
                    </div>
                    <Progress value={documentsProgress} className="h-1 mt-2" />
                  </div>

                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <CheckCircle className="h-4 w-4" />
                      Forms
                    </div>
                    <div className="text-2xl font-bold">
                      {caseItem.formsCompleted} / {caseItem.formsTotal}
                    </div>
                    <Progress
                      value={caseItem.formsTotal > 0 ? (caseItem.formsCompleted / caseItem.formsTotal) * 100 : 0}
                      className="h-1 mt-2"
                    />
                  </div>
                </div>

                <CaseTimeline caseId={caseItem.id} currentStatus={caseItem.status} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
