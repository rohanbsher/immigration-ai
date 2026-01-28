'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { FolderOpen, Files, Sparkles, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatLimit, isUnlimited } from '@/lib/billing/limits';

interface UsageMeterProps {
  limits: {
    maxCases: number;
    maxDocumentsPerCase: number;
    maxAiRequestsPerMonth: number;
    maxTeamMembers: number;
  };
  usage?: {
    cases?: number;
    documents?: number;
    aiRequests?: number;
    teamMembers?: number;
  };
}

interface MeterItemProps {
  icon: React.ElementType;
  label: string;
  current: number;
  max: number;
}

function MeterItem({ icon: Icon, label, current, max }: MeterItemProps) {
  const unlimited = isUnlimited(max);
  const percentage = unlimited ? 0 : Math.min((current / max) * 100, 100);

  const getColor = () => {
    if (unlimited) return 'bg-green-600';
    if (percentage >= 90) return 'bg-red-600';
    if (percentage >= 70) return 'bg-yellow-600';
    return 'bg-blue-600';
  };

  const getTextColor = () => {
    if (unlimited) return 'text-green-600';
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-slate-700';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-slate-500" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className={cn('text-sm font-medium', getTextColor())}>
          {current.toLocaleString()} / {formatLimit(max)}
        </span>
      </div>
      <Progress
        value={unlimited ? 100 : percentage}
        className="h-2"
        indicatorClassName={getColor()}
      />
    </div>
  );
}

export function UsageMeter({ limits, usage = {} }: UsageMeterProps) {
  const {
    cases = 0,
    documents = 0,
    aiRequests = 0,
    teamMembers = 1,
  } = usage;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Usage This Period</CardTitle>
        <CardDescription>Your current usage against plan limits</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <MeterItem
          icon={FolderOpen}
          label="Cases"
          current={cases}
          max={limits.maxCases}
        />
        <MeterItem
          icon={Files}
          label="Documents"
          current={documents}
          max={limits.maxDocumentsPerCase}
        />
        <MeterItem
          icon={Sparkles}
          label="AI Requests"
          current={aiRequests}
          max={limits.maxAiRequestsPerMonth}
        />
        <MeterItem
          icon={Users}
          label="Team Members"
          current={teamMembers}
          max={limits.maxTeamMembers}
        />
      </CardContent>
    </Card>
  );
}
