'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  X,
} from 'lucide-react';
import { useCases } from '@/hooks/use-cases';
import { useDocuments } from '@/hooks/use-documents';
import { DocumentsEmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeletons';
import type { DocumentStatus } from '@/types';

type SortField = 'file_name' | 'document_type' | 'status' | 'created_at' | 'file_size';
type SortDirection = 'asc' | 'desc';

const STATUS_CONFIG: Record<DocumentStatus, { label: string; className: string }> = {
  uploaded: { label: 'Uploaded', className: 'bg-muted text-muted-foreground' },
  processing: { label: 'Processing', className: 'bg-primary/10 text-primary' },
  analyzed: { label: 'Analyzed', className: 'bg-primary/10 text-primary' },
  needs_review: { label: 'Needs Review', className: 'bg-warning/10 text-warning' },
  verified: { label: 'Verified', className: 'bg-success/10 text-success' },
  rejected: { label: 'Rejected', className: 'bg-destructive/10 text-destructive' },
  expired: { label: 'Expired', className: 'bg-muted text-muted-foreground' },
};

const STATUS_FILTERS: { value: DocumentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'uploaded', label: 'Uploaded' },
  { value: 'processing', label: 'Processing' },
  { value: 'analyzed', label: 'Analyzed' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
];

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function DocSortIcon({
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

export default function DocumentsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedCaseId, setSelectedCaseId] = useState<string | 'all'>('all');

  const { data: casesData, isLoading: casesLoading } = useCases({}, { limit: 100 });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  if (casesLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasCases = casesData?.cases && casesData.cases.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl tracking-tight text-foreground">Documents</h1>
          <p className="text-muted-foreground">View and manage all case documents</p>
        </div>
      </div>

      {hasCases ? (
        <DocumentsTableView
          cases={casesData!.cases}
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          selectedCaseId={selectedCaseId}
          onSelectedCaseIdChange={setSelectedCaseId}
        />
      ) : (
        <Card>
          <CardContent className="p-6">
            <DocumentsEmptyState />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface CaseData {
  id: string;
  title: string;
  visa_type: string;
  client: { first_name: string; last_name: string };
}

function DocumentsTableView({
  cases,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortField,
  sortDirection,
  onSort,
  selectedCaseId,
  onSelectedCaseIdChange,
}: {
  cases: CaseData[];
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: DocumentStatus | 'all';
  onStatusFilterChange: (v: DocumentStatus | 'all') => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  selectedCaseId: string | 'all';
  onSelectedCaseIdChange: (v: string | 'all') => void;
}) {
  const activeCaseIds = selectedCaseId === 'all'
    ? cases.slice(0, 10).map((c) => c.id)
    : [selectedCaseId];

  return (
    <>
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search documents by name..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <select
                value={selectedCaseId}
                onChange={(e) => onSelectedCaseIdChange(e.target.value)}
                className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="all">All Cases</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.client.first_name} {c.client.last_name} - {c.visa_type}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value as DocumentStatus | 'all')}
                className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {STATUS_FILTERS.map((sf) => (
                  <option key={sf.value} value={sf.value}>{sf.label}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Active filter chips */}
          {(statusFilter !== 'all' || selectedCaseId !== 'all') && (
            <div className="flex flex-wrap gap-2 mt-3">
              {statusFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1 pl-2 pr-1">
                  Status: {STATUS_FILTERS.find((s) => s.value === statusFilter)?.label}
                  <button
                    onClick={() => onStatusFilterChange('all')}
                    className="ml-1 rounded-full p-0.5 hover:bg-muted"
                    aria-label="Remove status filter"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              )}
              {selectedCaseId !== 'all' && (
                <Badge variant="secondary" className="gap-1 pl-2 pr-1">
                  Case: {cases.find((c) => c.id === selectedCaseId)?.title || 'Selected'}
                  <button
                    onClick={() => onSelectedCaseIdChange('all')}
                    className="ml-1 rounded-full p-0.5 hover:bg-muted"
                    aria-label="Remove case filter"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents for each active case */}
      {activeCaseIds.map((caseId) => {
        const caseData = cases.find((c) => c.id === caseId);
        if (!caseData) return null;
        return (
          <CaseDocumentsTable
            key={caseId}
            caseId={caseId}
            caseTitle={caseData.title}
            caseVisaType={caseData.visa_type}
            clientName={`${caseData.client.first_name} ${caseData.client.last_name}`}
            search={search}
            statusFilter={statusFilter}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={onSort}
            showCaseHeader={selectedCaseId === 'all'}
          />
        );
      })}
    </>
  );
}

function CaseDocumentsTable({
  caseId,
  caseTitle,
  caseVisaType,
  clientName,
  search,
  statusFilter,
  sortField,
  sortDirection,
  onSort,
  showCaseHeader,
}: {
  caseId: string;
  caseTitle: string;
  caseVisaType: string;
  clientName: string;
  search: string;
  statusFilter: DocumentStatus | 'all';
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  showCaseHeader: boolean;
}) {
  const { data: documents, isLoading } = useDocuments(caseId);

  const filteredAndSorted = useMemo(() => {
    if (!documents) return [];
    let filtered = [...documents];

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((d) => d.file_name.toLowerCase().includes(q));
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((d) => d.status === statusFilter);
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'file_name':
          comparison = a.file_name.localeCompare(b.file_name);
          break;
        case 'document_type':
          comparison = a.document_type.localeCompare(b.document_type);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'file_size':
          comparison = a.file_size - b.file_size;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [documents, search, statusFilter, sortField, sortDirection]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (filteredAndSorted.length === 0) {
    if (!documents || documents.length === 0) return null;
    if (search || statusFilter !== 'all') {
      return (
        <Card>
          {showCaseHeader && (
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{clientName} - {caseVisaType}</CardTitle>
                <Link href={`/dashboard/cases/${caseId}?tab=documents`}>
                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                    View case <ExternalLink size={12} />
                  </Button>
                </Link>
              </div>
            </CardHeader>
          )}
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">No documents match your filters in this case.</p>
          </CardContent>
        </Card>
      );
    }
    return null;
  }

  return (
    <Card>
      {showCaseHeader && (
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{clientName} - {caseVisaType}</CardTitle>
            <Link href={`/dashboard/cases/${caseId}?tab=documents`}>
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                View case <ExternalLink size={12} />
              </Button>
            </Link>
          </div>
        </CardHeader>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <button
                onClick={() => onSort('file_name')}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                Name <DocSortIcon field="file_name" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            {!showCaseHeader && (
              <TableHead>Case</TableHead>
            )}
            <TableHead>
              <button
                onClick={() => onSort('document_type')}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                Type <DocSortIcon field="document_type" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead>
              <button
                onClick={() => onSort('status')}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                Status <DocSortIcon field="status" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead>
              <button
                onClick={() => onSort('created_at')}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                Uploaded <DocSortIcon field="created_at" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead>
              <button
                onClick={() => onSort('file_size')}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                Size <DocSortIcon field="file_size" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredAndSorted.map((doc) => {
            const statusCfg = STATUS_CONFIG[doc.status as DocumentStatus] || STATUS_CONFIG.uploaded;
            return (
              <TableRow key={doc.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-muted-foreground flex-shrink-0" />
                    <span className="font-medium text-foreground truncate max-w-[240px]">
                      {doc.file_name}
                    </span>
                  </div>
                </TableCell>
                {!showCaseHeader && (
                  <TableCell className="text-muted-foreground">
                    <Link
                      href={`/dashboard/cases/${caseId}`}
                      className="hover:text-primary hover:underline"
                    >
                      {caseTitle}
                    </Link>
                  </TableCell>
                )}
                <TableCell>
                  <Badge variant="outline">
                    {doc.document_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={statusCfg.className}>
                    {statusCfg.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(doc.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatFileSize(doc.file_size)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
