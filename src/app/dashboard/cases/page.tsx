'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  LayoutGrid,
  LayoutList,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  Archive,
  ChevronDown,
} from 'lucide-react';
import { CaseCard, CaseFilters, CaseStatusBadge, getStatusesForFilter, CreateCaseDialog } from '@/components/cases';
import { useCases, useDeleteCase, useUpdateCase } from '@/hooks/use-cases';
import { CasesEmptyState } from '@/components/ui/empty-state';
import { CaseCardSkeleton, ListSkeleton } from '@/components/ui/skeletons';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { VisaType, CaseStatus } from '@/types';

const PAGE_SIZE = 20;
const VIEW_PREFERENCE_KEY = 'cases-view-mode';

type ViewMode = 'card' | 'table';
type SortField = 'title' | 'client' | 'visa_type' | 'status' | 'updated_at' | 'deadline';
type SortDirection = 'asc' | 'desc';

function CaseSortIcon({
  field,
  sortField,
  sortDirection,
}: {
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
}) {
  if (sortField !== field) return <ArrowUpDown size={14} className="text-muted-foreground/50" />;
  return sortDirection === 'asc' ? (
    <ArrowUp size={14} className="text-primary" />
  ) : (
    <ArrowDown size={14} className="text-primary" />
  );
}

function getSavedViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'card';
  return (localStorage.getItem(VIEW_PREFERENCE_KEY) as ViewMode) || 'card';
}

export default function CasesPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'filed' | 'closed'>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [caseToArchive, setCaseToArchive] = useState<string | null>(null);
  const [visaTypeFilter, setVisaTypeFilter] = useState<VisaType | undefined>(undefined);
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'week' | 'month' | 'quarter'>('all');
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);

  useEffect(() => {
    setViewMode(getSavedViewMode());
  }, []);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_PREFERENCE_KEY, mode);
    setSelectedIds(new Set());
  };

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
      visa_type: visaTypeFilter,
    },
    { page, limit: PAGE_SIZE }
  );

  const { mutate: deleteCase } = useDeleteCase();
  const { mutate: updateCase } = useUpdateCase();

  const sortedCases = useMemo(() => {
    if (!data?.cases) return [];
    const cases = [...data.cases];
    cases.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'client':
          comparison = `${a.client.last_name} ${a.client.first_name}`.localeCompare(
            `${b.client.last_name} ${b.client.first_name}`
          );
          break;
        case 'visa_type':
          comparison = a.visa_type.localeCompare(b.visa_type);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'updated_at':
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
        case 'deadline':
          const aDate = a.deadline ? new Date(a.deadline).getTime() : Infinity;
          const bDate = b.deadline ? new Date(b.deadline).getTime() : Infinity;
          comparison = aDate - bDate;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return cases;
  }, [data?.cases, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDelete = (id: string) => {
    setCaseToArchive(id);
    setArchiveDialogOpen(true);
  };

  const handleConfirmArchive = () => {
    if (!caseToArchive) return;
    deleteCase(caseToArchive, {
      onSuccess: () => {
        toast.success('Case archived successfully');
        setArchiveDialogOpen(false);
        setCaseToArchive(null);
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to archive case');
      },
    });
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (!sortedCases.length) return;
    if (selectedIds.size === sortedCases.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedCases.map((c) => c.id)));
    }
  }, [sortedCases, selectedIds.size]);

  const handleBulkStatusChange = (newStatus: CaseStatus) => {
    const ids = Array.from(selectedIds);
    let completed = 0;
    ids.forEach((id) => {
      updateCase(
        { id, data: { status: newStatus } },
        {
          onSuccess: () => {
            completed++;
            if (completed === ids.length) {
              toast.success(`Updated ${ids.length} case${ids.length > 1 ? 's' : ''} to ${newStatus.replace(/_/g, ' ')}`);
              setSelectedIds(new Set());
            }
          },
          onError: (error) => {
            toast.error(error.message || 'Failed to update case');
          },
        }
      );
    });
  };

  const handleBulkArchive = () => {
    const ids = Array.from(selectedIds);
    let completed = 0;
    ids.forEach((id) => {
      deleteCase(id, {
        onSuccess: () => {
          completed++;
          if (completed === ids.length) {
            toast.success(`Archived ${ids.length} case${ids.length > 1 ? 's' : ''}`);
            setSelectedIds(new Set());
            setBulkArchiveOpen(false);
          }
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to archive case');
        },
      });
    });
  };

  const allSelected = sortedCases.length > 0 && selectedIds.size === sortedCases.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < sortedCases.length;
  const hasCases = data?.cases && data.cases.length > 0;
  const hasFilters = search || statusFilter !== 'all' || visaTypeFilter || dateRangeFilter !== 'all';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl tracking-tight text-foreground">Cases</h1>
          <p className="text-muted-foreground">Manage your immigration cases</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center rounded-lg border border-border p-1">
            <button
              onClick={() => handleViewModeChange('card')}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewMode === 'card'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label="Card view"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => handleViewModeChange('table')}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewMode === 'table'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label="Table view"
            >
              <LayoutList size={16} />
            </button>
          </div>
          <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
            <Plus size={18} />
            New Case
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <CaseFilters
            search={search}
            onSearchChange={handleSearchChange}
            statusFilter={statusFilter}
            onStatusFilterChange={handleStatusFilterChange}
            visaTypeFilter={visaTypeFilter}
            onVisaTypeFilterChange={(v) => { setVisaTypeFilter(v); setPage(1); }}
            dateRangeFilter={dateRangeFilter}
            onDateRangeFilterChange={(v) => { setDateRangeFilter(v); setPage(1); }}
          />
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <span className="text-sm font-medium text-foreground">
            {selectedIds.size} case{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  Change Status <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(['intake', 'document_collection', 'in_review', 'forms_preparation', 'ready_for_filing', 'filed', 'pending_response', 'approved', 'denied', 'closed'] as CaseStatus[]).map((status) => (
                  <DropdownMenuItem
                    key={status}
                    onClick={() => handleBulkStatusChange(status)}
                  >
                    {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-destructive hover:text-destructive"
              onClick={() => setBulkArchiveOpen(true)}
            >
              <Archive size={14} />
              Archive
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Cases List */}
      {isLoading ? (
        <ListSkeleton count={4} ItemSkeleton={CaseCardSkeleton} />
      ) : error ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Failed to load cases. Please try again.</p>
            <Button variant="outline" className="mt-4" onClick={() => router.refresh()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : hasCases ? (
        viewMode === 'table' ? (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      ref={(el) => {
                        if (el) {
                          (el as unknown as HTMLButtonElement).dataset.state =
                            someSelected ? 'indeterminate' : allSelected ? 'checked' : 'unchecked';
                        }
                      }}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all cases"
                    />
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort('status')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      Status <CaseSortIcon field="status" sortField={sortField} sortDirection={sortDirection} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort('title')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      Case Title <CaseSortIcon field="title" sortField={sortField} sortDirection={sortDirection} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort('client')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      Client <CaseSortIcon field="client" sortField={sortField} sortDirection={sortDirection} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort('visa_type')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      Visa Type <CaseSortIcon field="visa_type" sortField={sortField} sortDirection={sortDirection} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort('deadline')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      Deadline <CaseSortIcon field="deadline" sortField={sortField} sortDirection={sortDirection} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort('updated_at')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      Last Updated <CaseSortIcon field="updated_at" sortField={sortField} sortDirection={sortDirection} />
                    </button>
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCases.map((caseItem) => (
                  <TableRow
                    key={caseItem.id}
                    data-state={selectedIds.has(caseItem.id) ? 'selected' : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(caseItem.id)}
                        onCheckedChange={() => toggleSelect(caseItem.id)}
                        aria-label={`Select ${caseItem.title}`}
                      />
                    </TableCell>
                    <TableCell>
                      <CaseStatusBadge status={caseItem.status as CaseStatus} />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/cases/${caseItem.id}`}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {caseItem.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {caseItem.client.first_name} {caseItem.client.last_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{caseItem.visa_type}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {caseItem.deadline
                        ? new Date(caseItem.deadline).toLocaleDateString()
                        : '\u2014'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(caseItem.updated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Case actions">
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/cases/${caseItem.id}`}>View Details</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/cases/${caseItem.id}?tab=documents`}>
                              Upload Documents
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/cases/${caseItem.id}?tab=forms`}>
                              Create Form
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(caseItem.id)}
                            className="text-destructive"
                          >
                            Archive Case
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <div className="space-y-4">
            {sortedCases.map((caseItem) => (
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
        )
      ) : hasFilters ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No cases match your search criteria.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setVisaTypeFilter(undefined);
                setDateRangeFilter('all');
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
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

      {/* Archive Confirmation Dialog */}
      <ConfirmationDialog
        open={archiveDialogOpen}
        onOpenChange={(open) => {
          setArchiveDialogOpen(open);
          if (!open) setCaseToArchive(null);
        }}
        title="Archive Case"
        description="Are you sure you want to archive this case? You can restore it later from the archived cases view."
        confirmLabel="Archive Case"
        onConfirm={handleConfirmArchive}
        variant="destructive"
      />

      {/* Bulk Archive Confirmation Dialog */}
      <ConfirmationDialog
        open={bulkArchiveOpen}
        onOpenChange={setBulkArchiveOpen}
        title="Archive Selected Cases"
        description={`Are you sure you want to archive ${selectedIds.size} case${selectedIds.size > 1 ? 's' : ''}? You can restore them later.`}
        confirmLabel="Archive All"
        onConfirm={handleBulkArchive}
        variant="destructive"
      />
    </div>
  );
}
