'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CaseStatusBadge } from '@/components/cases';
import { MotionCard, MotionList, MotionListItem, MotionSlideUp } from '@/components/ui/motion';
import { AnimatedCounter } from '@/components/visualizations/animated-counter';
import { StatusChart } from '@/components/visualizations/status-chart';
import {
  FolderOpen,
  FileText,
  Users,
  Clock,
  Plus,
  ArrowRight,
  FileUp,
  Loader2,
} from 'lucide-react';
import { useCases, useCaseStats } from '@/hooks/use-cases';
import { useUser } from '@/hooks/use-user';
import { DeadlineWidget } from '@/components/dashboard/deadline-widget';
import { SuccessScoreBadge } from '@/components/ai/success-score-badge';
import type { CaseStatus } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  in_progress: '#3b82f6',
  under_review: '#8b5cf6',
  approved: '#22c55e',
  denied: '#ef4444',
  completed: '#10b981',
};

export default function DashboardPage() {
  const { profile, isLoading: profileLoading } = useUser();
  const { data: casesData, isLoading: casesLoading } = useCases({}, { limit: 4 });
  const { data: stats, isLoading: statsLoading } = useCaseStats();

  const isLoading = profileLoading || casesLoading || statsLoading;

  const dashboardStats = [
    {
      label: 'Active Cases',
      value: stats?.total || 0,
      icon: FolderOpen,
      change: 'Total cases',
    },
    {
      label: 'Pending Documents',
      value: 0,
      icon: FileText,
      change: 'Need review',
    },
    {
      label: 'Total Clients',
      value: casesData?.cases?.length || 0,
      icon: Users,
      change: 'Unique clients',
    },
    {
      label: 'Upcoming Deadlines',
      value: stats?.pendingDeadlines || 0,
      icon: Clock,
      change: 'This week',
    },
  ];

  const statusChartData = stats?.byStatus
    ? Object.entries(stats.byStatus).map(([status, count]) => ({
        name: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        value: count as number,
        color: STATUS_COLORS[status] || '#6b7280',
      }))
    : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const userName = profile?.first_name || 'there';

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <MotionSlideUp>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Welcome back, {userName}</h1>
            <p className="text-muted-foreground">
              Here&apos;s what&apos;s happening with your cases today.
            </p>
          </div>
          <Link href="/dashboard/cases/new">
            <Button className="gap-2">
              <Plus size={18} />
              New Case
            </Button>
          </Link>
        </div>
      </MotionSlideUp>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {dashboardStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <MotionCard key={stat.label} delay={index * 0.1}>
              <Card className="hover:shadow-lg hover:shadow-primary/10 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-3xl font-bold text-foreground mt-1">
                        <AnimatedCounter value={stat.value} duration={1.5} />
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
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

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Cases */}
        <MotionCard delay={0.3} className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Cases</CardTitle>
              <Link href="/dashboard/cases">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All <ArrowRight size={16} />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {casesData?.cases && casesData.cases.length > 0 ? (
                <MotionList className="space-y-4">
                  {casesData.cases.map((caseItem) => (
                    <MotionListItem key={caseItem.id}>
                      <Link
                        href={`/dashboard/cases/${caseItem.id}`}
                        className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-medium text-secondary-foreground">
                            {caseItem.client.first_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {caseItem.client.first_name} {caseItem.client.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {caseItem.visa_type} Application
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <SuccessScoreBadge caseId={caseItem.id} size="sm" />
                          <CaseStatusBadge status={caseItem.status as CaseStatus} />
                          <span className="text-sm text-muted-foreground hidden sm:block">
                            {new Date(caseItem.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                      </Link>
                    </MotionListItem>
                  ))}
                </MotionList>
              ) : (
                <div className="text-center py-8">
                  <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No cases yet.</p>
                  <Link href="/dashboard/cases/new">
                    <Button className="mt-4 gap-2">
                      <Plus size={16} />
                      Create First Case
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </MotionCard>

        {/* Status Overview */}
        <div className="space-y-6">
          <MotionCard delay={0.4}>
            <Card>
              <CardHeader>
                <CardTitle>Status Overview</CardTitle>
              </CardHeader>
              <CardContent>
                {statusChartData.length > 0 ? (
                  <StatusChart data={statusChartData} />
                ) : (
                  <p className="text-muted-foreground text-center py-4">No data available</p>
                )}
              </CardContent>
            </Card>
          </MotionCard>

          {/* Deadline Widget */}
          <MotionCard delay={0.5}>
            <DeadlineWidget maxItems={4} />
          </MotionCard>
        </div>
      </div>

      {/* Quick Actions */}
      <MotionSlideUp delay={0.5}>
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <QuickAction
                href="/dashboard/documents/upload"
                icon={FileUp}
                label="Upload Documents"
              />
              <QuickAction
                href="/dashboard/forms/new"
                icon={FileText}
                label="Create Form"
              />
              <QuickAction
                href="/dashboard/clients/new"
                icon={Users}
                label="Add Client"
              />
              <QuickAction
                href="/dashboard/cases/new"
                icon={FolderOpen}
                label="New Case"
              />
            </div>
          </CardContent>
        </Card>
      </MotionSlideUp>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all duration-200 gap-2"
    >
      <Icon className="text-muted-foreground" size={24} />
      <span className="text-sm font-medium text-foreground">{label}</span>
    </Link>
  );
}
