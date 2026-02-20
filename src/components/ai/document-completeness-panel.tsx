'use client';

import { cn } from '@/lib/utils';
import { useDocumentCompleteness } from '@/hooks/use-document-completeness';
import { AIBadge, AIContentBox, AILoading } from '@/components/ai';
import { FileText, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import type { CompletenessResult } from '@/lib/ai/document-completeness';

import {
  CompletenessBadge,
  CompactnessBar,
  ProgressRing,
  FilingReadinessBadge,
  DocumentSection,
  UploadedDocumentsSection,
  RecommendationsSection,
} from './document-completeness-parts';

interface DocumentCompletenessPanelProps {
  caseId: string;
  variant?: 'full' | 'compact' | 'mini';
  showRecommendations?: boolean;
  className?: string;
  onUploadClick?: (documentType: string) => void;
}

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

  const isDegraded = error || !data || (data as CompletenessResult & { degraded?: boolean }).degraded;

  if (isDegraded) {
    return (
      <div className={cn('p-4 rounded-lg border border-dashed border-border bg-muted/50', className)}>
        <div className="flex items-center gap-3 text-muted-foreground">
          <FileText size={20} />
          <div>
            <p className="text-sm font-medium text-muted-foreground">Document Completeness</p>
            <p className="text-xs text-muted-foreground/70">
              Upload documents to see completeness analysis and filing readiness.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'mini') {
    return <CompletenessBadge completeness={data.overallCompleteness} className={className} />;
  }

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
          <p className="text-sm text-muted-foreground">
            {data.uploadedRequired} of {data.totalRequired} required documents uploaded
          </p>
        </div>
      </div>

      {/* Checklists */}
      <div className="space-y-4">
        {data.missingRequired?.length > 0 && (
          <DocumentSection
            title="Missing Required"
            documents={data.missingRequired}
            icon={<AlertCircle className="text-destructive" size={16} />}
            type="missing"
            onUploadClick={onUploadClick}
            caseId={caseId}
          />
        )}

        {data.uploadedDocs?.length > 0 && (
          <UploadedDocumentsSection
            documents={data.uploadedDocs}
            caseId={caseId}
          />
        )}

        {data.missingOptional?.length > 0 && (
          <DocumentSection
            title="Optional Documents"
            documents={data.missingOptional}
            icon={<FileText className="text-muted-foreground" size={16} />}
            type="optional"
            onUploadClick={onUploadClick}
            caseId={caseId}
            collapsed
          />
        )}
      </div>

      {/* Recommendations */}
      {showRecommendations && data.recommendations?.length > 0 && (
        <RecommendationsSection recommendations={data.recommendations} />
      )}
    </AIContentBox>
  );
}

export { CompletenessBadge, ProgressRing, FilingReadinessBadge };
