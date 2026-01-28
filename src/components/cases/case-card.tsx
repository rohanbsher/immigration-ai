'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CaseStatusBadge } from './case-status-badge';
import { SuccessScoreBadge } from '@/components/ai/success-score-badge';
import { MoreVertical, Calendar, FileText, User } from 'lucide-react';
import type { CaseStatus, VisaType } from '@/types';

interface CaseCardProps {
  id: string;
  title: string;
  client: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  visaType: VisaType;
  status: CaseStatus;
  deadline?: string | null;
  documentsCount: number;
  formsCount: number;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function CaseCard({
  id,
  title,
  client,
  visaType,
  status,
  deadline,
  documentsCount,
  formsCount,
  onEdit,
  onDelete,
}: CaseCardProps) {
  const clientName = `${client.first_name} ${client.last_name}`;
  const clientInitial = client.first_name.charAt(0);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left: Case Info */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">
              {clientInitial}
            </div>
            <div>
              <Link
                href={`/dashboard/cases/${id}`}
                className="font-semibold text-slate-900 hover:text-blue-600"
              >
                {title}
              </Link>
              <div className="flex items-center gap-2 mt-1">
                <User size={14} className="text-slate-400" />
                <span className="text-sm text-slate-600">{clientName}</span>
                <Badge variant="outline">{visaType}</Badge>
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <FileText size={14} />
                  {documentsCount} docs
                </span>
                <span className="flex items-center gap-1">
                  <FileText size={14} />
                  {formsCount} forms
                </span>
                {deadline && (
                  <span className="flex items-center gap-1">
                    <Calendar size={14} />
                    Due {new Date(deadline).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Status and Actions */}
          <div className="flex items-center gap-3">
            <SuccessScoreBadge caseId={id} size="sm" />
            <CaseStatusBadge status={status} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Case actions menu">
                  <MoreVertical size={18} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/cases/${id}`}>View Details</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEdit}>Edit Case</DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/cases/${id}?tab=documents`}>
                    Upload Documents
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/cases/${id}?tab=forms`}>
                    Create Form
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-red-600"
                >
                  Archive Case
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
