'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MotionCard, MotionSlideUp } from '@/components/ui/motion';
import { Skeleton, StatsCardSkeleton, GridSkeleton } from '@/components/ui/skeletons';

const AnimatedCounter = dynamic(
  () => import('@/components/visualizations/animated-counter').then(mod => ({ default: mod.AnimatedCounter })),
  { ssr: false, loading: () => <span className="inline-block h-9 w-12 animate-pulse rounded bg-muted" /> }
);

const CaseStatusBadge = dynamic(
  () => import('@/components/cases').then(mod => ({ default: mod.CaseStatusBadge })),
  { ssr: false, loading: () => <Skeleton className="h-6 w-20 rounded-full" /> }
);
import { useRoleGuard } from '@/hooks/use-role-guard';
import { useCases, useCaseStats } from '@/hooks/use-cases';
import {
  FolderOpen,
  CheckCircle2,
  Clock,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

const StatusChart = dynamic(
  () => import('@/components/visualizations/status-chart').then(mod => ({ default: mod.StatusChart })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-48 rounded-lg" />,
  }
);

const VisaTypeChart = dynamic(
  () => import('@/components/visualizations/visa-type-chart').then(mod => ({ default: mod.VisaTypeChart })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-64 rounded-lg" />,
  }
);
import type { CaseStatus } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  intake: '#6b7280',
  document_collection: '#f59e0b',
  in_review: '#8b5cf6',
  forms_preparation: '#3b82f6',
  ready_for_filing: '#06b6d4',
  filed: '#2563eb',
  pending_response: '#f97316',
  approved: '#22c55e',
  denied: '#ef4444',
  closed: '#9ca3af',
};

const VISA_TYPE_COLORS = [
  '#3b82f6', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b',
  '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
  '#84cc16', '#e11d48', '#0ea5e9', '#a855f7', '#10b981',
  '#eab308',
];

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AnalyticsPage() {
  const { isLoading: guardLoading, hasAccess } = useRoleGuard({
    requiredRoles: ['attorney', 'admin'],
  });
  const { data: stats, isLoading: statsLoading } = useCaseStats();
  const { data: casesData, isLoading: casesLoading } = useCases({}, { limit: 200 });

  const isLoading = guardLoading || statsLoading || casesLoading;
  const cases = useMemo(() => casesData?.cases ?? [], [casesData?.cases]);

  // Compute derived analytics from cases
  const analytics = useMemo(() => {
    if (!cases.length) {
      return {
        approvalRate: 0,
        activeCases: 0,
        avgProcessingDays: 0,
        visaTypeData: [],
        recentActivity: [],
      };
    }

    const approvedCount = cases.filter((c) => c.status === 'approved').length;
    const deniedCount = cases.filter((c) => c.status === 'denied').length;
    const resolvedCount = approvedCount + deniedCount;
    const approvalRate = resolvedCount > 0
      ? Math.round((approvedCount / resolvedCount) * 100)
      : 0;

    const activeStatuses: CaseStatus[] = [
      'intake', 'document_collection', 'in_review', 'forms_preparation',
      'ready_for_filing', 'filed', 'pending_response',
    ];
    const activeCases = cases.filter((c) =>
      activeStatuses.includes(c.status as CaseStatus)
    ).length;

    // Average processing time for resolved cases
    const resolvedCases = cases.filter(
      (c) => c.status === 'approved' || c.status === 'denied' || c.status === 'closed'
    );
    let avgProcessingDays = 0;
    if (resolvedCases.length > 0) {
      const totalDays = resolvedCases.reduce((sum, c) => {
        const created = new Date(c.created_at).getTime();
        const updated = new Date(c.updated_at).getTime();
        return sum + (updated - created) / (1000 * 60 * 60 * 24);
      }, 0);
      avgProcessingDays = Math.round(totalDays / resolvedCases.length);
    }

    // Group by visa type
    const visaTypeCounts: Record<string, number> = {};
    for (const c of cases) {
      visaTypeCounts[c.visa_type] = (visaTypeCounts[c.visa_type] || 0) + 1;
    }
    const visaTypeData = Object.entries(visaTypeCounts)
      .map(([type, count], i) => ({
        name: type,
        count,
        fill: VISA_TYPE_COLORS[i % VISA_TYPE_COLORS.length],
      }))
      .sort((a, b) => b.count - a.count);

    // Recent activity: last 10 updated cases
    const recentActivity = [...cases]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 10);

    return {
      approvalRate,
      activeCases,
      avgProcessingDays,
      visaTypeData,
      recentActivity,
    };
  }, [cases]);

  const statusChartData = stats?.byStatus
    ? Object.entries(stats.byStatus).map(([status, count]) => ({
        name: formatStatusLabel(status),
        value: count as number,
        color: STATUS_COLORS[status] || '#6b7280',
      }))
    : [];

  if (!hasAccess && !guardLoading) return null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <GridSkeleton count={4} ItemSkeleton={StatsCardSkeleton} columns={4} />
        <div className="grid lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  const kpiCards = [
    {
      label: 'Total Cases',
      value: stats?.total || 0,
      icon: FolderOpen,
      description: 'All time',
    },
    {
      label: 'Approval Rate',
      value: analytics.approvalRate,
      icon: CheckCircle2,
      suffix: '%',
      description: 'Of resolved cases',
    },
    {
      label: 'Avg Processing',
      value: analytics.avgProcessingDays,
      icon: Clock,
      suffix: 'd',
      description: 'Days to resolution',
    },
    {
      label: 'Active Cases',
      value: analytics.activeCases,
      icon: TrendingUp,
      description: 'Currently in progress',
    },
  ];

  const hasData = cases.length > 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <MotionSlideUp>
        <div>
          <h1 className="font-display text-2xl tracking-tight text-foreground">Analytics</h1>
          <p className="text-muted-foreground">
            Insights and metrics across your cases.
          </p>
        </div>
      </MotionSlideUp>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <MotionCard key={kpi.label} delay={index * 0.1}>
              <Card className="hover:shadow-lg hover:shadow-primary/10 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{kpi.label}</p>
                      <p className="text-3xl font-bold text-foreground mt-1">
                        <AnimatedCounter value={kpi.value} duration={1.5} suffix={kpi.suffix} />
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="text-primary" size={24} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </MotionCard>
          );
        })}
      </div>

      {hasData ? (
        <>
          {/* Charts Row */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Status Distribution */}
            <MotionCard delay={0.3}>
              <Card>
                <CardHeader>
                  <CardTitle>Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {statusChartData.length > 0 ? (
                    <StatusChart data={statusChartData} />
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No status data</p>
                  )}
                </CardContent>
              </Card>
            </MotionCard>

            {/* Cases by Visa Type */}
            <MotionCard delay={0.4}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 size={18} />
                    Cases by Visa Type
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.visaTypeData.length > 0 ? (
                    <VisaTypeChart data={analytics.visaTypeData} />
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No visa type data</p>
                  )}
                </CardContent>
              </Card>
            </MotionCard>
          </div>

          {/* Recent Activity */}
          <MotionCard delay={0.5}>
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.recentActivity.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.recentActivity.map((caseItem) => (
                      <div
                        key={caseItem.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center font-medium text-secondary-foreground text-sm shrink-0">
                            {caseItem.client.first_name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">
                              {caseItem.client.first_name} {caseItem.client.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {caseItem.visa_type} &middot; {caseItem.title}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <CaseStatusBadge status={caseItem.status as CaseStatus} />
                          <span className="text-xs text-muted-foreground hidden sm:block">
                            {new Date(caseItem.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No recent activity</p>
                )}
              </CardContent>
            </Card>
          </MotionCard>
        </>
      ) : (
        <MotionCard delay={0.3}>
          <Card>
            <CardContent className="py-16 text-center">
              <BarChart3 className="mx-auto text-muted-foreground mb-4" size={48} />
              <h3 className="text-lg font-medium text-foreground mb-2">No data yet</h3>
              <p className="text-muted-foreground">
                Create your first case to see analytics and insights here.
              </p>
            </CardContent>
          </Card>
        </MotionCard>
      )}
    </div>
  );
}
