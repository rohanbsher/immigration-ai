'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, TrendingUp, Users } from 'lucide-react';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

interface AdminStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  mrr: number;
  mrrGrowth: number | null;
}

async function fetchSubscriptionStats(): Promise<AdminStats> {
  const response = await fetchWithTimeout('/api/admin/stats', { timeout: 'QUICK' });
  if (!response.ok) {
    throw new Error('Failed to fetch subscription stats');
  }
  const data = await response.json();
  return data.data;
}

export default function AdminSubscriptionsPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-subscription-stats'],
    queryFn: fetchSubscriptionStats,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl tracking-tight">Subscriptions</h1>
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
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
      title: 'Active Subscriptions',
      value: stats?.activeSubscriptions || 0,
      description: `${stats?.totalSubscriptions || 0} total subscriptions`,
      icon: Users,
    },
    {
      title: 'Total Subscriptions',
      value: stats?.totalSubscriptions || 0,
      description: 'All time',
      icon: CreditCard,
    },
    {
      title: 'MRR',
      value: `$${((stats?.mrr || 0) / 100).toLocaleString()}`, // Stripe returns cents
      description: stats?.mrrGrowth
        ? `${stats.mrrGrowth >= 0 ? '+' : ''}${stats.mrrGrowth}% growth`
        : 'Monthly Recurring Revenue',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Subscriptions</h1>
        <p className="text-muted-foreground">
          Monitor subscription metrics and revenue
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Plan Distribution card: implement when /api/admin/stats returns per-plan counts */}
    </div>
  );
}
