'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Briefcase, FileText, CreditCard, TrendingUp, TrendingDown } from 'lucide-react';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

interface AdminStats {
  totalUsers: number;
  newUsersThisMonth: number;
  userGrowth: number;
  totalCases: number;
  activeCases: number;
  totalDocuments: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  mrr: number;
  mrrGrowth: number;
}

async function fetchAdminStats(): Promise<AdminStats> {
  const response = await fetchWithTimeout('/api/admin/stats', { timeout: 'QUICK' });
  if (!response.ok) {
    throw new Error('Failed to fetch admin stats');
  }
  const data = await response.json();
  return data.data;
}

export default function AdminDashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: fetchAdminStats,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers || 0,
      description: `${stats?.newUsersThisMonth || 0} new this month`,
      icon: Users,
      trend: stats?.userGrowth || 0,
    },
    {
      title: 'Active Cases',
      value: stats?.activeCases || 0,
      description: `${stats?.totalCases || 0} total cases`,
      icon: Briefcase,
    },
    {
      title: 'Documents',
      value: stats?.totalDocuments || 0,
      description: 'Total uploaded',
      icon: FileText,
    },
    {
      title: 'Active Subscriptions',
      value: stats?.activeSubscriptions || 0,
      description: `${stats?.totalSubscriptions || 0} total`,
      icon: CreditCard,
    },
    {
      title: 'MRR',
      value: `$${((stats?.mrr || 0) / 100).toLocaleString()}`,
      description: 'Monthly Recurring Revenue',
      icon: CreditCard,
      trend: stats?.mrrGrowth || 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of system metrics and activity
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {stat.trend !== undefined && (
                    <>
                      {stat.trend >= 0 ? (
                        <TrendingUp className="h-3 w-3 text-success" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-destructive" />
                      )}
                      <span className={stat.trend >= 0 ? 'text-success' : 'text-destructive'}>
                        {Math.abs(stat.trend)}%
                      </span>
                    </>
                  )}
                  <span>{stat.description}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Activity feed coming soon...
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Database</span>
                <span className="text-sm text-success">Healthy</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">API</span>
                <span className="text-sm text-success">Operational</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Storage</span>
                <span className="text-sm text-success">Available</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
