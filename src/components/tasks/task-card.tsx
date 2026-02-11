'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Calendar,
  User,
  FolderOpen,
  Loader2,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCompleteTask, useDeleteTask, type Task, type TaskPriority } from '@/hooks/use-tasks';
import { toast } from 'sonner';

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-slate-100 text-slate-600' },
  medium: { label: 'Medium', className: 'bg-blue-100 text-blue-600' },
  high: { label: 'High', className: 'bg-orange-100 text-orange-600' },
  urgent: { label: 'Urgent', className: 'bg-red-100 text-red-600' },
};

interface TaskCardProps {
  task: Task;
  showCase?: boolean;
  onDelete?: () => void;
  compact?: boolean;
}

export function TaskCard({ task, showCase = false, onDelete, compact = false }: TaskCardProps) {
  const { mutate: completeTask, isPending: isCompleting } = useCompleteTask();
  const { mutate: deleteTask, isPending: isDeleting } = useDeleteTask();

  const priorityConfig = PRIORITY_CONFIG[task.priority];

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';

  const handleComplete = () => {
    completeTask(task.id, {
      onSuccess: () => toast.success('Task completed'),
      onError: (error) => toast.error(error.message),
    });
  };

  const handleDelete = () => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    deleteTask(task.id, {
      onSuccess: () => {
        toast.success('Task deleted');
        onDelete?.();
      },
      onError: (error) => toast.error(error.message),
    });
  };

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg border',
          task.status === 'completed' && 'opacity-60'
        )}
      >
        <Checkbox
          checked={task.status === 'completed'}
          onCheckedChange={() => task.status !== 'completed' && handleComplete()}
          disabled={isCompleting || task.status === 'completed'}
        />
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-medium truncate', task.status === 'completed' && 'line-through')}>
            {task.title}
          </p>
          {task.due_date && (
            <p className={cn('text-xs', isOverdue ? 'text-red-500' : 'text-muted-foreground')}>
              Due {format(new Date(task.due_date), 'MMM d')}
            </p>
          )}
        </div>
        <Badge className={cn('text-xs', priorityConfig.className)}>
          {priorityConfig.label}
        </Badge>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'p-4 rounded-lg border space-y-3',
        task.status === 'completed' && 'opacity-60',
        isOverdue && 'border-red-200'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <Checkbox
            className="mt-1"
            checked={task.status === 'completed'}
            onCheckedChange={() => task.status !== 'completed' && handleComplete()}
            disabled={isCompleting || task.status === 'completed'}
          />
          <div>
            <h4 className={cn('font-medium', task.status === 'completed' && 'line-through')}>
              {task.title}
            </h4>
            {task.description && (
              <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn('text-xs', priorityConfig.className)}>
            {priorityConfig.label}
          </Badge>
          {task.status !== 'completed' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-destructive hover:text-destructive h-7 w-7 p-0"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {task.due_date && (
          <span className={cn('flex items-center gap-1', isOverdue && 'text-red-500')}>
            <Calendar className="h-3 w-3" />
            {isOverdue ? 'Overdue: ' : 'Due '}
            {format(new Date(task.due_date), 'MMM d, yyyy')}
          </span>
        )}
        {task.assignee && (
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {task.assignee.first_name} {task.assignee.last_name}
          </span>
        )}
        {showCase && task.case && (
          <span className="flex items-center gap-1">
            <FolderOpen className="h-3 w-3" />
            {task.case.title}
          </span>
        )}
      </div>

      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
