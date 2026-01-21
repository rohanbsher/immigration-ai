'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CaseStatusBadge } from '@/components/cases';
import {
  FolderOpen,
  FileText,
  Users,
  Clock,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileUp,
  Loader2,
} from 'lucide-react';
import { useCases, useCaseStats } from '@/hooks/use-cases';
import { useUser } from '@/hooks/use-user';
import type { CaseStatus, VisaType } from '@/types';

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const userName = profile?.first_name || 'there';

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back, {userName}</h1>
          <p className="text-slate-600">
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {dashboardStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">{stat.label}</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">
                      {stat.value}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{stat.change}</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Icon className="text-blue-600" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Cases */}
        <Card className="lg:col-span-2">
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
              <div className="space-y-4">
                {casesData.cases.map((caseItem) => (
                  <Link
                    key={caseItem.id}
                    href={`/dashboard/cases/${caseItem.id}`}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-medium text-slate-700">
                        {caseItem.client.first_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {caseItem.client.first_name} {caseItem.client.last_name}
                        </p>
                        <p className="text-sm text-slate-500">
                          {caseItem.visa_type} Application
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <CaseStatusBadge status={caseItem.status as CaseStatus} />
                      <span className="text-sm text-slate-500 hidden sm:block">
                        {new Date(caseItem.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FolderOpen className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-600">No cases yet.</p>
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

        {/* Status Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.byStatus ? (
              <div className="space-y-3">
                {Object.entries(stats.byStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <CaseStatusBadge status={status as CaseStatus} />
                    <span className="font-medium">{count as number}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-4">No data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
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
      className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors gap-2"
    >
      <Icon className="text-slate-600" size={24} />
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </Link>
  );
}
