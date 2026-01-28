'use client';

import { TaskList } from '@/components/tasks';

export default function TasksPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tasks</h1>
        <p className="text-muted-foreground">
          Manage your tasks and track progress across all cases.
        </p>
      </div>

      <TaskList showCase={true} />
    </div>
  );
}
