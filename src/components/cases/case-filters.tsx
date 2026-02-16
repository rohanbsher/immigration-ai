'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Filter } from 'lucide-react';
import type { CaseStatus } from '@/types';

interface CaseFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: 'all' | 'active' | 'filed' | 'closed';
  onStatusFilterChange: (value: 'all' | 'active' | 'filed' | 'closed') => void;
}

export function CaseFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: CaseFiltersProps) {
  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="relative flex-1">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <Input
          placeholder="Search cases by title..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      <div className="flex gap-2">
        <Tabs value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as typeof statusFilter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="filed">Filed</TabsTrigger>
            <TabsTrigger value="closed">Closed</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" className="gap-2">
          <Filter size={16} />
          Filter
        </Button>
      </div>
    </div>
  );
}

export function getStatusesForFilter(filter: 'all' | 'active' | 'filed' | 'closed'): CaseStatus[] | undefined {
  switch (filter) {
    case 'active':
      return ['intake', 'document_collection', 'in_review', 'forms_preparation', 'ready_for_filing', 'pending_response'];
    case 'filed':
      return ['filed', 'approved', 'denied'];
    case 'closed':
      return ['closed'];
    default:
      return undefined;
  }
}
