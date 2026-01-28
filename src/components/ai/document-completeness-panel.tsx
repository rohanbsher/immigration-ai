'use client';

import { cn } from '@/lib/utils';
import {
  useDocumentCompleteness,
  getCompletenessColor,
  getFilingReadinessInfo,
} from '@/hooks/use-document-completeness';
import { AIBadge, AIContentBox, AILoading } from '@/components/ai';
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

interface DocumentCompletenessPanelProps {
  caseId: string;
  variant?: 'full' | 'compact' | 'mini';
  showRecommendations?: boolean;
  className?: string;
  onUploadClick?: (documentType: string) => void;
}

/**
 * Document Completeness Panel
 *
 * Displays document completeness analysis with progress ring,
 * checklist, and recommendations.
 */
export function DocumentCompletenessPanel({
  caseId,
  variant = 'full',
  showRecommendations = true,
  className,
  onUploadClick,
}: DocumentCompletenessPanelProps) {
  const { data, isLoading, error } = useDocumentCompleteness(caseId);
  const [isExpanded, setIsExpanded] = useState(variant === 'full');

  if (isLoading) {
    return (
      <div className={cn('p-4', className)}>
        <AILoading message="Analyzing documents" variant="minimal" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-4 text-red-600 flex items-center gap-2', className)}>
        <AlertCircle size={16} />
        <span className="text-sm">Failed to analyze completeness</span>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Mini variant - just shows percentage badge
  if (variant === 'mini') {
    return <CompletnessBadge completeness={data.overallCompleteness} className={className} />;
  }

  // Compact variant - progress bar only
  if (variant === 'compact') {
    return (
      <CompactnessBar
        data={data}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
        className={className}
      />
    );
  }

  // Full variant
  return (
    <AIContentBox
      title="Document Completeness"
      variant="bordered"
      className={className}
    >
      {/* Progress Overview */}
      <div className="flex items-center gap-6 mb-6">
        <ProgressRing completeness={data.overallCompleteness} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <FilingReadinessBadge readiness={data.filingReadiness} />
            <AIBadge size="sm" label="AI" showTooltip tooltipText="AI-powered analysis" />
          </div>
          <p className="text-sm text-slate-600">
            {data.uploadedRequired} of {data.totalRequired} required documents uploaded
          </p>
        </div>
      </div>

      {/* Checklists */}
      <div className="space-y-4">
        {/* Missing Required Documents */}
        {data.missingRequired.length > 0 && (
          <DocumentSection
            title="Missing Required"
            documents={data.missingRequired}
            icon={<AlertCircle className="text-red-500" size={16} />}
            type="missing"
            onUploadClick={onUploadClick}
            caseId={caseId}
          />
        )}

        {/* Uploaded Documents */}
        {data.uploadedDocs.length > 0 && (
          <UploadedDocumentsSection
            documents={data.uploadedDocs}
            caseId={caseId}
          />
        )}

        {/* Missing Optional Documents */}
        {data.missingOptional.length > 0 && (
          <DocumentSection
            title="Optional Documents"
            documents={data.missingOptional}
            icon={<FileText className="text-slate-400" size={16} />}
            type="optional"
            onUploadClick={onUploadClick}
            caseId={caseId}
            collapsed
          />
        )}
      </div>

      {/* Recommendations */}
      {showRecommendations && data.recommendations.length > 0 && (
        <RecommendationsSection recommendations={data.recommendations} />
      )}
    </AIContentBox>
  );
}

/**
 * Compact completeness badge.
 */
function CompletnessBadge({
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

/**
 * Compact progress bar with expandable details.
 */
function CompactnessBar({
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
          <FileText size={14} className="text-purple-500" />
          <span className="font-medium">Documents</span>
          <span className={cn('text-xs', colors.text)}>
            {data.overallCompleteness}%
          </span>
        </div>
        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      <Progress value={data.overallCompleteness} className="h-2" />

      {isExpanded && (
        <div className="pt-2 space-y-1 text-xs text-slate-600">
          <p>
            {data.uploadedRequired}/{data.totalRequired} required uploaded
          </p>
          {data.missingRequired.length > 0 && (
            <p className="text-red-600">
              Missing: {data.missingRequired.map((d) => d.displayName).join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Circular progress ring.
 */
function ProgressRing({
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
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
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

/**
 * Filing readiness badge.
 */
function FilingReadinessBadge({
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

/**
 * Section for missing documents.
 */
function DocumentSection({
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
        className="flex items-center gap-2 w-full text-sm font-medium text-slate-700 mb-2"
      >
        {icon}
        <span>{title}</span>
        <span className="text-xs text-slate-400">({documents.length})</span>
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
                <span className={type === 'missing' ? 'text-red-700' : 'text-slate-600'}>
                  {doc.displayName}
                </span>
                {doc.description && (
                  <p className="text-xs text-slate-400 mt-0.5">{doc.description}</p>
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
                  className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
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

/**
 * Section for uploaded documents.
 */
function UploadedDocumentsSection({
  documents,
  caseId,
}: {
  documents: UploadedDocumentInfo[];
  caseId: string;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const statusIcons: Record<UploadedDocumentInfo['status'], React.ReactNode> = {
    verified: <CheckCircle2 className="text-green-500" size={14} />,
    needs_review: <AlertTriangle className="text-yellow-500" size={14} />,
    processing: <Clock className="text-blue-500 animate-pulse" size={14} />,
    rejected: <AlertCircle className="text-red-500" size={14} />,
  };

  return (
    <div>
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-2 w-full text-sm font-medium text-slate-700 mb-2"
      >
        <CheckCircle2 className="text-green-500" size={16} />
        <span>Uploaded Documents</span>
        <span className="text-xs text-slate-400">({documents.length})</span>
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
                <span className="text-slate-700">{doc.displayName}</span>
                {doc.isExpired && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600">
                    Expired
                  </span>
                )}
                {doc.isExpiringSoon && !doc.isExpired && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-600">
                    Expiring Soon
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">
                  {Math.round(doc.quality * 100)}%
                </span>
                <Link
                  href={`/dashboard/cases/${caseId}/documents/${doc.id}`}
                  className="text-slate-400 hover:text-slate-600"
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

/**
 * Recommendations section.
 */
function RecommendationsSection({
  recommendations,
}: {
  recommendations: string[];
}) {
  return (
    <div className="mt-4 pt-4 border-t border-purple-100">
      <h4 className="text-sm font-medium text-purple-700 mb-2 flex items-center gap-2">
        <AlertTriangle size={14} />
        Recommendations
      </h4>
      <ul className="space-y-2">
        {recommendations.map((rec, index) => (
          <li
            key={index}
            className="text-sm text-slate-600 flex items-start gap-2"
          >
            <span className="text-purple-400 mt-1">•</span>
            <span>{rec}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Export individual components for flexibility.
 */
export { CompletnessBadge, ProgressRing, FilingReadinessBadge };
