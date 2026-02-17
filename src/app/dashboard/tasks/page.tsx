'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { TaskCard } from '@/components/tasks/task-card';
import { CreateTaskDialog } from '@/components/tasks/create-task-dialog';
import {
  useTasks,
  useCompleteTask,
  useUpdateTask,
  type TaskStatus,
  type TaskPriority,
} from '@/hooks/use-tasks';
import {
  Plus,
  Search,
  LayoutGrid,
  LayoutList,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  CheckCircle2,
  ChevronDown,
  Calendar,
  FolderOpen,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

const VIEW_PREFERENCE_KEY = 'tasks-view-mode';
type ViewMode = 'card' | 'table';
type SortField = 'title' | 'due_date' | 'priority' | 'status' | 'created_at';
type SortDirection = 'asc' | 'desc';

const STATUS_TABS: { value: TaskStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

const PRIORITY_OPTIONS: { value: TaskPriority | 'all'; label: string }[] = [
  { value: 'all', label: 'All Priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; className: string; sortOrder: number }> = {
  urgent: { label: 'Urgent', className: 'bg-destructive/10 text-destructive', sortOrder: 0 },
  high: { label: 'High', className: 'bg-amber-100 text-amber-700', sortOrder: 1 },
  medium: { label: 'Medium', className: 'bg-primary/10 text-primary', sortOrder: 2 },
  low: { label: 'Low', className: 'bg-muted text-muted-foreground', sortOrder: 3 },
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; className: string; sortOrder: number }> = {
  pending: { label: 'To Do', className: 'bg-muted text-muted-foreground', sortOrder: 0 },
  in_progress: { label: 'In Progress', className: 'bg-primary/10 text-primary', sortOrder: 1 },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700', sortOrder: 2 },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground', sortOrder: 3 },
};

function TaskSortIcon({
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

export default function TasksPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('due_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setViewMode(getSavedViewMode());
  }, []);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_PREFERENCE_KEY, mode);
    setSelectedIds(new Set());
  };

  const { data: tasks, isLoading, error } = useTasks({
    status: statusFilter === 'all' ? undefined : statusFilter,
    priority: priorityFilter === 'all' ? undefined : priorityFilter,
    search: search || undefined,
  });

  const { mutate: completeTask } = useCompleteTask();
  const { mutate: updateTask } = useUpdateTask();

  const filteredTasks = useMemo(() => tasks || [], [tasks]);

  const sortedTasks = useMemo(() => {
    const sorted = [...filteredTasks];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'due_date': {
          const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          comparison = aDate - bDate;
          break;
        }
        case 'priority':
          comparison = PRIORITY_CONFIG[a.priority].sortOrder - PRIORITY_CONFIG[b.priority].sortOrder;
          break;
        case 'status':
          comparison = STATUS_CONFIG[a.status].sortOrder - STATUS_CONFIG[b.status].sortOrder;
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredTasks, sortField, sortDirection]);

  const tasksByStatus = {
    pending: filteredTasks.filter((t) => t.status === 'pending'),
    in_progress: filteredTasks.filter((t) => t.status === 'in_progress'),
    completed: filteredTasks.filter((t) => t.status === 'completed'),
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
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
    if (!sortedTasks.length) return;
    if (selectedIds.size === sortedTasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedTasks.map((t) => t.id)));
    }
  }, [sortedTasks, selectedIds.size]);

  const handleBulkComplete = () => {
    const ids = Array.from(selectedIds);
    let completed = 0;
    ids.forEach((id) => {
      completeTask(id, {
        onSuccess: () => {
          completed++;
          if (completed === ids.length) {
            toast.success(`Completed ${ids.length} task${ids.length > 1 ? 's' : ''}`);
            setSelectedIds(new Set());
          }
        },
        onError: (err) => {
          toast.error(err.message || 'Failed to complete task');
        },
      });
    });
  };

  const handleBulkPriorityChange = (priority: TaskPriority) => {
    const ids = Array.from(selectedIds);
    let completed = 0;
    ids.forEach((id) => {
      updateTask(
        { id, data: { priority } },
        {
          onSuccess: () => {
            completed++;
            if (completed === ids.length) {
              toast.success(`Updated priority for ${ids.length} task${ids.length > 1 ? 's' : ''}`);
              setSelectedIds(new Set());
            }
          },
          onError: (err) => {
            toast.error(err.message || 'Failed to update task');
          },
        }
      );
    });
  };

  const allSelected = sortedTasks.length > 0 && selectedIds.size === sortedTasks.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < sortedTasks.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
          <p className="text-muted-foreground">
            Manage your tasks and track progress across all cases.
          </p>
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
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            <Plus size={18} />
            New Task
          </Button>
        </div>
      </div>

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
                placeholder="Search tasks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | 'all')}
              className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {/* Active filter chips */}
          {(priorityFilter !== 'all' || statusFilter !== 'all') && (
            <div className="flex flex-wrap gap-2 mt-3">
              {statusFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1 pl-2 pr-1">
                  Status: {STATUS_TABS.find((s) => s.value === statusFilter)?.label}
                  <button
                    onClick={() => setStatusFilter('all')}
                    className="ml-1 rounded-full p-0.5 hover:bg-muted"
                    aria-label="Remove status filter"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              )}
              {priorityFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1 pl-2 pr-1">
                  Priority: {PRIORITY_OPTIONS.find((p) => p.value === priorityFilter)?.label}
                  <button
                    onClick={() => setPriorityFilter('all')}
                    className="ml-1 rounded-full p-0.5 hover:bg-muted"
                    aria-label="Remove priority filter"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Tabs */}
      <div className="flex gap-2 border-b border-border">
        {STATUS_TABS.map((tab) => {
          const count =
            tab.value === 'all'
              ? filteredTasks.length
              : tasksByStatus[tab.value as keyof typeof tasksByStatus]?.length || 0;

          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                statusFilter === tab.value
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
              <Badge variant="secondary" className="ml-2 text-xs">
                {count}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <span className="text-sm font-medium text-foreground">
            {selectedIds.size} task{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={handleBulkComplete}
            >
              <CheckCircle2 size={14} />
              Complete
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  Set Priority <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(['urgent', 'high', 'medium', 'low'] as TaskPriority[]).map((p) => (
                  <DropdownMenuItem
                    key={p}
                    onClick={() => handleBulkPriorityChange(p)}
                  >
                    {PRIORITY_CONFIG[p].label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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

      {/* Task List/Table */}
      {error ? (
        <div className="text-center py-8 text-muted-foreground">
          Failed to load tasks. Please try again.
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No tasks found</p>
          <Button variant="link" onClick={() => setIsCreateOpen(true)} className="mt-2">
            Create your first task
          </Button>
        </div>
      ) : viewMode === 'table' ? (
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
                    aria-label="Select all tasks"
                  />
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('status')}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Status <TaskSortIcon field="status" sortField={sortField} sortDirection={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('title')}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Task <TaskSortIcon field="title" sortField={sortField} sortDirection={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('priority')}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Priority <TaskSortIcon field="priority" sortField={sortField} sortDirection={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('due_date')}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Due Date <TaskSortIcon field="due_date" sortField={sortField} sortDirection={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Case</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTasks.map((task) => {
                const priorityCfg = PRIORITY_CONFIG[task.priority];
                const statusCfg = STATUS_CONFIG[task.status];
                const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
                return (
                  <TableRow
                    key={task.id}
                    data-state={selectedIds.has(task.id) ? 'selected' : undefined}
                    className={cn(task.status === 'completed' && 'opacity-60')}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(task.id)}
                        onCheckedChange={() => toggleSelect(task.id)}
                        aria-label={`Select ${task.title}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusCfg.className}>
                        {statusCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={cn('font-medium text-foreground', task.status === 'completed' && 'line-through')}>
                        {task.title}
                      </span>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[300px]">
                          {task.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={priorityCfg.className}>
                        {priorityCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {task.due_date ? (
                        <span className={cn(
                          'flex items-center gap-1 text-sm',
                          isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'
                        )}>
                          <Calendar size={12} />
                          {format(new Date(task.due_date), 'MMM d, yyyy')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{'\u2014'}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {task.assignee
                        ? `${task.assignee.first_name} ${task.assignee.last_name}`
                        : '\u2014'}
                    </TableCell>
                    <TableCell>
                      {task.case ? (
                        <Link
                          href={`/dashboard/cases/${task.case.id}`}
                          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary hover:underline"
                        >
                          <FolderOpen size={12} />
                          {task.case.title}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{'\u2014'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              showCase={true}
            />
          ))}
        </div>
      )}

      <CreateTaskDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </div>
  );
}
