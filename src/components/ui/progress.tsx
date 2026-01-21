'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';

import { cn } from '@/lib/utils';

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  indicatorClassName?: string;
}

const Progress = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, indicatorClassName, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      'relative h-4 w-full overflow-hidden rounded-full bg-slate-100',
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn('h-full w-full flex-1 bg-blue-600 transition-all', indicatorClassName)}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

// File upload progress component
interface FileProgressProps {
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  errorMessage?: string;
  className?: string;
}

function FileProgress({
  fileName,
  progress,
  status,
  errorMessage,
  className,
}: FileProgressProps) {
  const statusColors = {
    pending: 'bg-slate-300',
    uploading: 'bg-blue-600',
    complete: 'bg-green-600',
    error: 'bg-red-600',
  };

  const statusText = {
    pending: 'Waiting...',
    uploading: `${Math.round(progress)}%`,
    complete: 'Complete',
    error: 'Failed',
  };

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="truncate max-w-[200px] text-slate-700">{fileName}</span>
        <span
          className={cn(
            'text-xs font-medium',
            status === 'error' ? 'text-red-600' : 'text-slate-500'
          )}
        >
          {statusText[status]}
        </span>
      </div>
      <Progress
        value={status === 'complete' ? 100 : progress}
        className="h-1.5"
        indicatorClassName={statusColors[status]}
      />
      {status === 'error' && errorMessage && (
        <p className="text-xs text-red-600">{errorMessage}</p>
      )}
    </div>
  );
}

// Multi-file upload progress
interface UploadProgressProps {
  files: {
    name: string;
    progress: number;
    status: 'pending' | 'uploading' | 'complete' | 'error';
    errorMessage?: string;
  }[];
}

function UploadProgress({ files }: UploadProgressProps) {
  const completedCount = files.filter((f) => f.status === 'complete').length;
  const totalCount = files.length;
  const overallProgress = totalCount > 0
    ? Math.round(files.reduce((acc, f) => acc + f.progress, 0) / totalCount)
    : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-900">
          Uploading {completedCount}/{totalCount} files
        </span>
        <span className="text-sm text-slate-500">{overallProgress}%</span>
      </div>
      <Progress value={overallProgress} className="h-2" />
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {files.map((file, index) => (
          <FileProgress
            key={`${file.name}-${index}`}
            fileName={file.name}
            progress={file.progress}
            status={file.status}
            errorMessage={file.errorMessage}
          />
        ))}
      </div>
    </div>
  );
}

export { Progress, FileProgress, UploadProgress };
