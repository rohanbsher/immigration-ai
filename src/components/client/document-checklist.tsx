'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Circle, Upload, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentRequirement {
  id: string;
  documentType: string;
  label: string;
  required: boolean;
  uploaded: boolean;
  status: 'pending' | 'uploaded' | 'verified' | 'rejected';
  notes?: string;
}

interface DocumentChecklistProps {
  caseId: string;
}

async function fetchDocumentRequirements(caseId: string): Promise<DocumentRequirement[]> {
  const response = await fetch(`/api/cases/${caseId}/checklist`);
  if (!response.ok) {
    throw new Error('Failed to fetch document checklist');
  }
  const data = await response.json();
  return data.data || [];
}

const STATUS_CONFIG = {
  pending: {
    icon: Circle,
    label: 'Needed',
    className: 'text-muted-foreground',
    badgeVariant: 'secondary' as const,
  },
  uploaded: {
    icon: Upload,
    label: 'Uploaded',
    className: 'text-blue-500',
    badgeVariant: 'default' as const,
  },
  verified: {
    icon: CheckCircle,
    label: 'Verified',
    className: 'text-green-500',
    badgeVariant: 'default' as const,
  },
  rejected: {
    icon: AlertCircle,
    label: 'Needs Revision',
    className: 'text-red-500',
    badgeVariant: 'destructive' as const,
  },
};

export function DocumentChecklist({ caseId }: DocumentChecklistProps) {
  const { data: requirements, isLoading } = useQuery({
    queryKey: ['document-checklist', caseId],
    queryFn: () => fetchDocumentRequirements(caseId),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Document Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!requirements || requirements.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Document Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No document requirements have been set for this case yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const uploadedCount = requirements.filter(r => r.uploaded).length;
  const verifiedCount = requirements.filter(r => r.status === 'verified').length;
  const totalRequired = requirements.filter(r => r.required).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Document Checklist</CardTitle>
          <div className="text-sm text-muted-foreground">
            {verifiedCount} / {totalRequired} verified
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {requirements.map((req) => {
            const config = STATUS_CONFIG[req.status];
            const Icon = config.icon;

            return (
              <div
                key={req.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border',
                  req.status === 'rejected' && 'border-red-200 bg-red-50'
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn('h-5 w-5', config.className)} />
                  <div>
                    <div className="font-medium text-sm">{req.label}</div>
                    {req.notes && (
                      <div className="text-xs text-muted-foreground">{req.notes}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {req.required && (
                    <Badge variant="outline" className="text-xs">
                      Required
                    </Badge>
                  )}
                  <Badge variant={config.badgeVariant} className="text-xs">
                    {config.label}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3 rounded-lg bg-muted/50">
          <div className="text-sm font-medium mb-1">Progress</div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{uploadedCount} uploaded</span>
            <span>{verifiedCount} verified</span>
            <span>{totalRequired - uploadedCount} remaining</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
