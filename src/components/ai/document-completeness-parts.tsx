'use client';

import { cn } from '@/lib/utils';
import {
  getCompletenessColor,
  getFilingReadinessInfo,
} from '@/hooks/use-document-completeness';
import {
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Upload,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import Link from 'next/link';
import type { CompletenessResult, DocumentRequirement, UploadedDocumentInfo } from '@/lib/ai/document-completeness';

export function CompletenessBadge({
  completeness,
  className,
}: {
  completeness: number;
  className?: string;
}) {
  const colors = getCompletenessColor(completeness);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
              colors.bg,
              colors.text,
              className
            )}
          >
            <FileText size={12} />
            {completeness}%
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Document completeness: {completeness}%</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function CompactnessBar({
  data,
  isExpanded,
  onToggle,
  className,
}: {
  data: CompletenessResult;
  isExpanded: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const colors = getCompletenessColor(data.overallCompleteness);

  return (
    <div className={cn('space-y-2', className)}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-sm"
      >
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-ai-accent" />
          <span className="font-medium">Documents</span>
          <span className={cn('text-xs', colors.text)}>
            {data.overallCompleteness}%
          </span>
        </div>
        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      <Progress value={data.overallCompleteness} className="h-2" />

      {isExpanded && (
        <div className="pt-2 space-y-1 text-xs text-muted-foreground">
          <p>
            {data.uploadedRequired}/{data.totalRequired} required uploaded
          </p>
          {data.missingRequired.length > 0 && (
            <p className="text-destructive">
              Missing: {data.missingRequired.map((d) => d.displayName).join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function ProgressRing({
  completeness,
  size = 80,
}: {
  completeness: number;
  size?: number;
}) {
  const colors = getCompletenessColor(completeness);
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (completeness / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={completeness >= 100 ? '#22c55e' : completeness >= 70 ? '#eab308' : '#ef4444'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('text-lg font-bold', colors.text)}>
          {completeness}%
        </span>
      </div>
    </div>
  );
}

export function FilingReadinessBadge({
  readiness,
}: {
  readiness: CompletenessResult['filingReadiness'];
}) {
  const info = getFilingReadinessInfo(readiness);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        info.bgColor,
        info.color
      )}
    >
      {readiness === 'ready' && <CheckCircle2 size={12} />}
      {readiness === 'needs_review' && <AlertTriangle size={12} />}
      {readiness === 'incomplete' && <AlertCircle size={12} />}
      {info.label}
    </span>
  );
}

export function DocumentSection({
  title,
  documents,
  icon,
  type,
  onUploadClick,
  caseId,
  collapsed = false,
}: {
  title: string;
  documents: DocumentRequirement[];
  icon: React.ReactNode;
  type: 'missing' | 'optional';
  onUploadClick?: (documentType: string) => void;
  caseId: string;
  collapsed?: boolean;
}) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);

  return (
    <div>
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-2 w-full text-sm font-medium text-foreground mb-2"
      >
        {icon}
        <span>{title}</span>
        <span className="text-xs text-muted-foreground">({documents.length})</span>
        {isCollapsed ? <ChevronDown size={14} className="ml-auto" /> : <ChevronUp size={14} className="ml-auto" />}
      </button>

      {!isCollapsed && (
        <ul className="space-y-2 pl-6">
          {documents.map((doc) => (
            <li
              key={doc.documentType}
              className="flex items-center justify-between text-sm"
            >
              <div>
                <span className={type === 'missing' ? 'text-destructive' : 'text-muted-foreground'}>
                  {doc.displayName}
                </span>
                {doc.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{doc.description}</p>
                )}
              </div>
              {onUploadClick ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUploadClick(doc.documentType)}
                  className="text-xs h-7 px-2"
                >
                  <Upload size={12} className="mr-1" />
                  Upload
                </Button>
              ) : (
                <Link
                  href={`/dashboard/cases/${caseId}/documents?upload=${doc.documentType}`}
                  className="text-xs text-ai-accent hover:text-ai-accent/80 flex items-center gap-1"
                >
                  <Upload size={12} />
                  Upload
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function UploadedDocumentsSection({
  documents,
  caseId,
}: {
  documents: UploadedDocumentInfo[];
  caseId: string;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const statusIcons: Record<UploadedDocumentInfo['status'], React.ReactNode> = {
    verified: <CheckCircle2 className="text-success" size={14} />,
    needs_review: <AlertTriangle className="text-warning" size={14} />,
    processing: <Clock className="text-primary animate-pulse" size={14} />,
    rejected: <AlertCircle className="text-destructive" size={14} />,
  };

  return (
    <div>
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-2 w-full text-sm font-medium text-foreground mb-2"
      >
        <CheckCircle2 className="text-success" size={16} />
        <span>Uploaded Documents</span>
        <span className="text-xs text-muted-foreground">({documents.length})</span>
        {isCollapsed ? <ChevronDown size={14} className="ml-auto" /> : <ChevronUp size={14} className="ml-auto" />}
      </button>

      {!isCollapsed && (
        <ul className="space-y-2 pl-6">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                {statusIcons[doc.status]}
                <span className="text-foreground">{doc.displayName}</span>
                {doc.isExpired && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                    Expired
                  </span>
                )}
                {doc.isExpiringSoon && !doc.isExpired && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-warning/10 text-warning">
                    Expiring Soon
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {Math.round(doc.quality * 100)}%
                </span>
                <Link
                  href={`/dashboard/cases/${caseId}/documents/${doc.id}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink size={12} />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RecommendationsSection({
  recommendations,
}: {
  recommendations: string[];
}) {
  return (
    <div className="mt-4 pt-4 border-t border-ai-accent/20">
      <h4 className="text-sm font-medium text-ai-accent mb-2 flex items-center gap-2">
        <AlertTriangle size={14} />
        Recommendations
      </h4>
      <ul className="space-y-2">
        {recommendations.map((rec, index) => (
          <li
            key={index}
            className="text-sm text-muted-foreground flex items-start gap-2"
          >
            <span className="text-ai-accent/60 mt-1">&#8226;</span>
            <span>{rec}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
