'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
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
  low: { label: 'Low', className: 'bg-muted text-muted-foreground' },
  medium: { label: 'Medium', className: 'bg-primary/10 text-primary' },
  high: { label: 'High', className: 'bg-warning/10 text-warning' },
  urgent: { label: 'Urgent', className: 'bg-destructive/10 text-destructive' },
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const priorityConfig = PRIORITY_CONFIG[task.priority];

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';

  const handleComplete = () => {
    completeTask(task.id, {
      onSuccess: () => toast.success('Task completed'),
      onError: (error) => toast.error(error.message),
    });
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    deleteTask(task.id, {
      onSuccess: () => {
        toast.success('Task deleted');
        setDeleteDialogOpen(false);
        onDelete?.();
      },
      onError: (error) => {
        toast.error(error.message);
        setDeleteDialogOpen(false);
      },
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
            <p className={cn('text-xs', isOverdue ? 'text-destructive' : 'text-muted-foreground')}>
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
        isOverdue && 'border-destructive/30'
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
              onClick={handleDeleteClick}
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
          <span className={cn('flex items-center gap-1', isOverdue && 'text-destructive')}>
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

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Task"
        description={`Are you sure you want to delete "${task.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        variant="destructive"
      />
    </div>
  );
}
