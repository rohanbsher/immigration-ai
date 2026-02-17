'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Filter, X } from 'lucide-react';
import type { CaseStatus, VisaType } from '@/types';

const VISA_TYPES: { value: VisaType; label: string }[] = [
  { value: 'I-130', label: 'I-130' },
  { value: 'I-485', label: 'I-485' },
  { value: 'I-765', label: 'I-765' },
  { value: 'I-131', label: 'I-131' },
  { value: 'N-400', label: 'N-400' },
  { value: 'H1B', label: 'H-1B' },
  { value: 'EB1', label: 'EB-1' },
  { value: 'EB2', label: 'EB-2' },
  { value: 'EB3', label: 'EB-3' },
  { value: 'EB5', label: 'EB-5' },
  { value: 'L1', label: 'L-1' },
  { value: 'O1', label: 'O-1' },
  { value: 'B1B2', label: 'B1/B2' },
  { value: 'F1', label: 'F-1' },
  { value: 'H4', label: 'H-4' },
  { value: 'other', label: 'Other' },
];

const DATE_RANGES = [
  { value: 'all', label: 'Any time' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
] as const;

type DateRange = typeof DATE_RANGES[number]['value'];

interface CaseFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: 'all' | 'active' | 'filed' | 'closed';
  onStatusFilterChange: (value: 'all' | 'active' | 'filed' | 'closed') => void;
  visaTypeFilter?: VisaType | undefined;
  onVisaTypeFilterChange?: (value: VisaType | undefined) => void;
  dateRangeFilter?: DateRange;
  onDateRangeFilterChange?: (value: DateRange) => void;
}

export function CaseFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  visaTypeFilter,
  onVisaTypeFilterChange,
  dateRangeFilter = 'all',
  onDateRangeFilterChange,
}: CaseFiltersProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [localVisaType, setLocalVisaType] = useState<VisaType | undefined>(visaTypeFilter);
  const [localDateRange, setLocalDateRange] = useState<DateRange>(dateRangeFilter);

  const activeFilterCount =
    (visaTypeFilter ? 1 : 0) + (dateRangeFilter !== 'all' ? 1 : 0);

  const handleApplyFilters = () => {
    onVisaTypeFilterChange?.(localVisaType);
    onDateRangeFilterChange?.(localDateRange);
    setFilterOpen(false);
  };

  const handleClearFilters = () => {
    setLocalVisaType(undefined);
    setLocalDateRange('all');
    onVisaTypeFilterChange?.(undefined);
    onDateRangeFilterChange?.('all');
    setFilterOpen(false);
  };

  const handleRemoveVisaType = () => {
    setLocalVisaType(undefined);
    onVisaTypeFilterChange?.(undefined);
  };

  const handleRemoveDateRange = () => {
    setLocalDateRange('all');
    onDateRangeFilterChange?.('all');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
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
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter size={16} />
                Filter
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Visa Type</label>
                  <Select
                    value={localVisaType ?? ''}
                    onValueChange={(v) => setLocalVisaType(v === '' ? undefined : v as VisaType)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All visa types" />
                    </SelectTrigger>
                    <SelectContent>
                      {VISA_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Date Created</label>
                  <Select
                    value={localDateRange}
                    onValueChange={(v) => setLocalDateRange(v as DateRange)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_RANGES.map((range) => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                    Clear all
                  </Button>
                  <Button size="sm" onClick={handleApplyFilters}>
                    Apply Filters
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {visaTypeFilter && (
            <Badge variant="secondary" className="gap-1 pl-2 pr-1">
              Visa: {VISA_TYPES.find((t) => t.value === visaTypeFilter)?.label ?? visaTypeFilter}
              <button
                onClick={handleRemoveVisaType}
                className="ml-1 rounded-full p-0.5 hover:bg-muted"
                aria-label="Remove visa type filter"
              >
                <X size={12} />
              </button>
            </Badge>
          )}
          {dateRangeFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1 pl-2 pr-1">
              Created: {DATE_RANGES.find((r) => r.value === dateRangeFilter)?.label}
              <button
                onClick={handleRemoveDateRange}
                className="ml-1 rounded-full p-0.5 hover:bg-muted"
                aria-label="Remove date range filter"
              >
                <X size={12} />
              </button>
            </Badge>
          )}
        </div>
      )}
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
