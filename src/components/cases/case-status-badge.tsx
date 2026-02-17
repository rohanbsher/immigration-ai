'use client';

import { Badge } from '@/components/ui/badge';
import type { CaseStatus } from '@/types';

const statusConfig: Record<CaseStatus, { label: string; className: string }> = {
  intake: { label: 'Intake', className: 'bg-muted text-muted-foreground hover:bg-muted' },
  document_collection: { label: 'Collecting Docs', className: 'bg-warning/10 text-warning hover:bg-warning/10' },
  in_review: { label: 'In Review', className: 'bg-info/10 text-info hover:bg-info/10' },
  forms_preparation: { label: 'Preparing Forms', className: 'bg-ai-accent-muted text-ai-accent hover:bg-ai-accent-muted' },
  ready_for_filing: { label: 'Ready to File', className: 'bg-primary/10 text-primary hover:bg-primary/10' },
  filed: { label: 'Filed', className: 'bg-success/10 text-success hover:bg-success/10' },
  pending_response: { label: 'Pending Response', className: 'bg-warning/10 text-warning hover:bg-warning/10' },
  approved: { label: 'Approved', className: 'bg-success/10 text-success hover:bg-success/10' },
  denied: { label: 'Denied', className: 'bg-destructive/10 text-destructive hover:bg-destructive/10' },
  closed: { label: 'Closed', className: 'bg-muted text-muted-foreground hover:bg-muted' },
};

interface CaseStatusBadgeProps {
  status: CaseStatus;
}

export function CaseStatusBadge({ status }: CaseStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.intake;

  return (
    <Badge variant="secondary" className={config.className}>
      {config.label}
    </Badge>
  );
}

export function getStatusLabel(status: CaseStatus): string {
  return statusConfig[status]?.label || status;
}

export function getStatusColor(status: CaseStatus): string {
  return statusConfig[status]?.className || statusConfig.intake.className;
}
