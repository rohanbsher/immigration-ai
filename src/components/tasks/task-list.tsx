'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TaskCard } from './task-card';
import { CreateTaskDialog } from './create-task-dialog';
import { useTasks, type Task, type TaskStatus, type TaskPriority } from '@/hooks/use-tasks';
import { Plus, Search, Filter, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface TaskListProps {
  caseId?: string;
  showCase?: boolean;
  compact?: boolean;
}

export function TaskList({ caseId, showCase = true, compact = false }: TaskListProps) {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: tasks, isLoading, error } = useTasks({
    case_id: caseId,
    status: statusFilter === 'all' ? undefined : statusFilter,
    priority: priorityFilter === 'all' ? undefined : priorityFilter,
    search: search || undefined,
  });

  const filteredTasks = tasks || [];

  const tasksByStatus = {
    pending: filteredTasks.filter((t) => t.status === 'pending'),
    in_progress: filteredTasks.filter((t) => t.status === 'in_progress'),
    completed: filteredTasks.filter((t) => t.status === 'completed'),
  };

  if (error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Failed to load tasks. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
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
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 border-b">
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

      {/* Task List */}
      {isLoading ? (
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
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              showCase={showCase && !caseId}
              compact={compact}
            />
          ))}
        </div>
      )}

      <CreateTaskDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        caseId={caseId}
      />
    </div>
  );
}
