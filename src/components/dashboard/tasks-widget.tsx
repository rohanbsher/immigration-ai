'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TaskCard, CreateTaskDialog } from '@/components/tasks';
import { useMyTasks } from '@/hooks/use-tasks';
import { ListTodo, Plus, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

export function TasksWidget() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: tasks, isLoading } = useMyTasks();

  // Show only incomplete tasks, sorted by due date
  const pendingTasks = (tasks || [])
    .filter((t) => t.status !== 'completed' && t.status !== 'cancelled')
    .sort((a, b) => {
      // Urgent first, then by due date
      if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
      if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    })
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <ListTodo className="h-5 w-5" />
          My Tasks
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : pendingTasks.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">No pending tasks</p>
            <Button
              variant="link"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="mt-1"
            >
              Create a task
            </Button>
          </div>
        ) : (
          <>
            {pendingTasks.map((task) => (
              <TaskCard key={task.id} task={task} compact showCase />
            ))}
            {(tasks?.length || 0) > 5 && (
              <Link href="/dashboard/tasks">
                <Button variant="ghost" className="w-full text-sm" size="sm">
                  View all tasks
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
          </>
        )}
      </CardContent>

      <CreateTaskDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </Card>
  );
}
