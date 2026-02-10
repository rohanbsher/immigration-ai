'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { CaseCard, CaseFilters, getStatusesForFilter, CreateCaseDialog } from '@/components/cases';
import { useCases, useDeleteCase } from '@/hooks/use-cases';
import { CasesEmptyState } from '@/components/ui/empty-state';
import { CaseCardSkeleton, ListSkeleton } from '@/components/ui/skeletons';
import { toast } from 'sonner';
import type { VisaType, CaseStatus } from '@/types';

const PAGE_SIZE = 20;

export default function CasesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'filed' | 'closed'>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [page, setPage] = useState(1);

  const statuses = getStatusesForFilter(statusFilter);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusFilterChange = (value: 'all' | 'active' | 'filed' | 'closed') => {
    setStatusFilter(value);
    setPage(1);
  };

  const { data, isLoading, error } = useCases(
    {
      search: search || undefined,
      status: statuses,
    },
    { page, limit: PAGE_SIZE }
  );

  const { mutate: deleteCase } = useDeleteCase();

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to archive this case?')) {
      deleteCase(id, {
        onSuccess: () => {
          toast.success('Case archived successfully');
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to archive case');
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cases</h1>
          <p className="text-muted-foreground">Manage your immigration cases</p>
        </div>
        <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
          <Plus size={18} />
          New Case
        </Button>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <CaseFilters
            search={search}
            onSearchChange={handleSearchChange}
            statusFilter={statusFilter}
            onStatusFilterChange={handleStatusFilterChange}
          />
        </CardContent>
      </Card>

      {/* Cases List */}
      {isLoading ? (
        <ListSkeleton count={4} ItemSkeleton={CaseCardSkeleton} />
      ) : error ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Failed to load cases. Please try again.</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : data?.cases && data.cases.length > 0 ? (
        <div className="space-y-4">
          {data.cases.map((caseItem) => (
            <CaseCard
              key={caseItem.id}
              id={caseItem.id}
              title={caseItem.title}
              client={caseItem.client}
              visaType={caseItem.visa_type as VisaType}
              status={caseItem.status as CaseStatus}
              deadline={caseItem.deadline}
              documentsCount={caseItem.documents_count}
              formsCount={caseItem.forms_count}
              onDelete={() => handleDelete(caseItem.id)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6">
            <CasesEmptyState onCreateCase={() => setCreateDialogOpen(true)} />
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1} to{' '}
            {Math.min(page * PAGE_SIZE, data.total)} of {data.total} cases
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
              disabled={page * PAGE_SIZE >= data.total}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create Case Dialog */}
      <CreateCaseDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
