'use client';

import { Badge } from '@/components/ui/badge';
import type { CaseStatus } from '@/types';

const statusConfig: Record<CaseStatus, { label: string; className: string }> = {
  intake: { label: 'Intake', className: 'bg-slate-100 text-slate-700 hover:bg-slate-100' },
  document_collection: { label: 'Collecting Docs', className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' },
  in_review: { label: 'In Review', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  forms_preparation: { label: 'Preparing Forms', className: 'bg-purple-100 text-purple-700 hover:bg-purple-100' },
  ready_for_filing: { label: 'Ready to File', className: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100' },
  filed: { label: 'Filed', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  pending_response: { label: 'Pending Response', className: 'bg-orange-100 text-orange-700 hover:bg-orange-100' },
  approved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
  denied: { label: 'Denied', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
  closed: { label: 'Closed', className: 'bg-gray-100 text-gray-700 hover:bg-gray-100' },
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
