'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { CaseCard, CaseFilters, getStatusesForFilter, CreateCaseDialog } from '@/components/cases';
import { useCases, useDeleteCase } from '@/hooks/use-cases';
import { toast } from 'sonner';
import type { VisaType, CaseStatus } from '@/types';

export default function CasesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'filed' | 'closed'>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const statuses = getStatusesForFilter(statusFilter);

  const { data, isLoading, error } = useCases(
    {
      search: search || undefined,
      status: statuses,
    },
    { page: 1, limit: 50 }
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
          <h1 className="text-2xl font-bold text-slate-900">Cases</h1>
          <p className="text-slate-600">Manage your immigration cases</p>
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
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />
        </CardContent>
      </Card>

      {/* Cases List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-slate-600">Failed to load cases. Please try again.</p>
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
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Plus className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No cases yet</h3>
            <p className="text-slate-600 mb-4">
              Get started by creating your first immigration case.
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
              <Plus size={18} />
              Create First Case
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Case Dialog */}
      <CreateCaseDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
