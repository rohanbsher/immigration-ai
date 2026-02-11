'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Users,
  Search,
  Loader2,
  Mail,
  Phone,
  FolderOpen,
  Calendar,
  Plus,
} from 'lucide-react';
import { useClientsPaginated } from '@/hooks/use-clients';
import { useRoleGuard } from '@/hooks/use-role-guard';
import { ClientsEmptyState, SearchEmptyState } from '@/components/ui/empty-state';
import { Skeleton, ClientCardSkeleton, GridSkeleton, StatsCardSkeleton } from '@/components/ui/skeletons';

const PAGE_SIZE = 20;

export default function ClientsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading: isClientsLoading, error } = useClientsPaginated(page, PAGE_SIZE, search || undefined);

  const clients = data?.data;
  const pagination = data?.pagination;

  // Protect this page - only attorneys and admins can access
  const { isLoading: isAuthLoading, hasAccess } = useRoleGuard({
    requiredRoles: ['attorney', 'admin'],
  });

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  // If still checking access or redirecting, show loading
  if (isAuthLoading || !hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (isClientsLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        {/* Search skeleton */}
        <Card>
          <CardContent className="p-4">
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        {/* Stats skeleton */}
        <GridSkeleton count={3} ItemSkeleton={StatsCardSkeleton} columns={3} />
        {/* Clients grid skeleton */}
        <GridSkeleton count={6} ItemSkeleton={ClientCardSkeleton} columns={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clients</h1>
          <p className="text-muted-foreground">Manage your client relationships</p>
        </div>
        <Link href="/dashboard/cases">
          <Button className="gap-2">
            <Plus size={18} />
            New Case (Add Client)
          </Button>
        </Link>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients by name or email..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold">{pagination?.total ?? 0}</p>
              <p className="text-sm text-muted-foreground">Total Clients</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <FolderOpen className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {clients?.reduce((sum, c) => sum + c.active_cases_count, 0) || 0}
              </p>
              <p className="text-sm text-muted-foreground">Active Cases</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
              <Calendar className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {clients?.reduce((sum, c) => sum + c.cases_count, 0) || 0}
              </p>
              <p className="text-sm text-muted-foreground">Total Cases</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clients List */}
      {error ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Failed to load clients. Please try again.</p>
          </CardContent>
        </Card>
      ) : clients && clients.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <Link key={client.id} href={`/dashboard/clients/${client.id}`}>
              <Card className="h-full hover:border-blue-400 hover:shadow-md transition-all cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={client.avatar_url || undefined} />
                      <AvatarFallback className="bg-blue-100 text-blue-700 font-medium">
                        {client.first_name.charAt(0)}
                        {client.last_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">
                        {client.first_name} {client.last_name}
                      </h3>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <Mail size={12} />
                        <span className="truncate">{client.email}</span>
                      </div>
                      {client.phone && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone size={12} />
                          <span>{client.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                      {client.cases_count} cases
                    </Badge>
                    {client.active_cases_count > 0 && (
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        {client.active_cases_count} active
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : pagination && pagination.total === 0 && !search ? (
        <Card>
          <CardContent className="p-6">
            <ClientsEmptyState />
          </CardContent>
        </Card>
      ) : clients && clients.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <SearchEmptyState query={search} />
          </CardContent>
        </Card>
      ) : null}

      {/* Pagination */}
      {pagination && pagination.total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1} to{' '}
            {Math.min(page * PAGE_SIZE, pagination.total)} of {pagination.total} clients
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page * PAGE_SIZE >= pagination.total}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
