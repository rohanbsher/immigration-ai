'use client';

import { cn } from '@/lib/utils';
import { useRFEAssessment, getRFERiskInfo } from '@/hooks/use-rfe-assessment';
import { AIContentBox, AIBadge, AILoading } from '@/components/ai';
import { AlertTriangle, Shield } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import type { RFEAssessmentResult, TriggeredRule } from '@/lib/ai/rfe/types';

interface RFERiskPanelProps {
  caseId: string;
  variant?: 'full' | 'compact' | 'mini';
  className?: string;
}

function RiskScoreGauge({ score, riskLevel }: { score: number; riskLevel: string }) {
  const info = getRFERiskInfo(riskLevel);
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-20 h-20 flex-shrink-0">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r="36"
          fill="none"
          stroke="currentColor"
          className="text-muted/20"
          strokeWidth="6"
        />
        <circle
          cx="40"
          cy="40"
          r="36"
          fill="none"
          className={info.color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-lg font-bold', info.color)}>{score}</span>
      </div>
    </div>
  );
}

function RiskBadge({ riskLevel }: { riskLevel: string }) {
  const info = getRFERiskInfo(riskLevel);
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', info.color, info.bgColor)}>
      {info.label}
    </Badge>
  );
}

function TriggeredRuleItem({ rule }: { rule: TriggeredRule }) {
  const [expanded, setExpanded] = useState(false);
  const severityColors: Record<string, string> = {
    critical: 'border-l-destructive',
    high: 'border-l-orange-500',
    medium: 'border-l-warning',
    low: 'border-l-muted-foreground',
  };

  return (
    <div
      className={cn(
        'border-l-4 pl-3 py-2 cursor-pointer hover:bg-muted/50 rounded-r',
        severityColors[rule.severity] ?? 'border-l-muted-foreground'
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle
            size={14}
            className={
              rule.severity === 'critical'
                ? 'text-destructive'
                : rule.severity === 'high'
                  ? 'text-orange-500'
                  : 'text-warning'
            }
          />
          <span className="text-sm font-medium truncate">{rule.title}</span>
        </div>
        <Badge variant="outline" className="text-[10px] ml-2 flex-shrink-0">
          {rule.severity}
        </Badge>
      </div>
      {expanded && (
        <div className="mt-2 space-y-2 text-xs text-muted-foreground">
          <ul className="list-disc pl-4 space-y-1">
            {rule.evidence?.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          <div className="mt-2 p-2 bg-muted/30 rounded text-xs">
            <strong>Action:</strong> {rule.recommendation}
          </div>
        </div>
      )}
    </div>
  );
}

export function RFERiskPanel({ caseId, variant = 'full', className }: RFERiskPanelProps) {
  const { data, isLoading, error } = useRFEAssessment(caseId);

  if (isLoading) {
    return (
      <div className={cn('p-4', className)}>
        <AILoading message="Assessing RFE risk" variant="minimal" />
      </div>
    );
  }

  const isDegraded =
    error || !data || (data as RFEAssessmentResult & { degraded?: boolean }).degraded;

  if (isDegraded) {
    return (
      <div
        className={cn(
          'p-4 rounded-lg border border-dashed border-border bg-muted/50',
          className
        )}
      >
        <div className="flex items-center gap-3 text-muted-foreground">
          <Shield size={20} />
          <div>
            <p className="text-sm font-medium">RFE Risk Assessment</p>
            <p className="text-xs text-muted-foreground/70">
              Upload documents to see RFE risk analysis.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'mini') {
    return <RiskBadge riskLevel={data.riskLevel} />;
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-3 p-3 rounded-lg border', className)}>
        <RiskScoreGauge score={data.rfeRiskScore} riskLevel={data.riskLevel} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <RiskBadge riskLevel={data.riskLevel} />
            <AIBadge size="sm" label="AI" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {data.triggeredRules?.length || 0} risk factor(s) found
          </p>
        </div>
      </div>
    );
  }

  // Full variant
  return (
    <AIContentBox title="RFE Risk Assessment" variant="bordered" className={className}>
      {/* Score Overview */}
      <div className="flex items-center gap-6 mb-4">
        <RiskScoreGauge score={data.rfeRiskScore} riskLevel={data.riskLevel} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <RiskBadge riskLevel={data.riskLevel} />
            <AIBadge
              size="sm"
              label="AI"
              showTooltip
              tooltipText="Rule-based RFE risk analysis"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {!data.triggeredRules?.length
              ? 'No RFE risk factors detected'
              : `${data.triggeredRules.length} risk factor(s) identified`}
          </p>
        </div>
      </div>

      {/* Triggered Rules */}
      {(data.triggeredRules?.length ?? 0) > 0 && (
        <div className="space-y-2 mb-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle size={14} className="text-warning" />
            Risk Factors
          </h4>
          <div className="space-y-1">
            {data.triggeredRules?.map((rule) => (
              <TriggeredRuleItem key={rule.ruleId} rule={rule} />
            ))}
          </div>
        </div>
      )}

      {/* Priority Actions */}
      {(data.priorityActions?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Shield size={14} className="text-success" />
            Priority Actions
          </h4>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
            {data.priorityActions?.map((action, i) => (
              <li key={i}>{action}</li>
            ))}
          </ol>
        </div>
      )}
    </AIContentBox>
  );
}
