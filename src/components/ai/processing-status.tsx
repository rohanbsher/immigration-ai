'use client';

import { cn } from '@/lib/utils';
import { Loader2, CheckCircle, XCircle, Brain, FileSearch, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export type ProcessingStage =
  | 'idle'
  | 'validating'
  | 'detecting_type'
  | 'extracting'
  | 'analyzing'
  | 'mapping'
  | 'complete'
  | 'error';

interface ProcessingStatusProps {
  stage: ProcessingStage;
  progress?: number;
  message?: string;
  error?: string;
  className?: string;
}

const stageConfig: Record<
  ProcessingStage,
  {
    icon: React.ElementType;
    label: string;
    color: string;
    animate?: boolean;
  }
> = {
  idle: {
    icon: Brain,
    label: 'Ready to analyze',
    color: 'text-slate-400',
  },
  validating: {
    icon: FileSearch,
    label: 'Validating document',
    color: 'text-blue-500',
    animate: true,
  },
  detecting_type: {
    icon: FileSearch,
    label: 'Detecting document type',
    color: 'text-blue-500',
    animate: true,
  },
  extracting: {
    icon: Sparkles,
    label: 'Extracting information',
    color: 'text-purple-500',
    animate: true,
  },
  analyzing: {
    icon: Brain,
    label: 'Analyzing data',
    color: 'text-purple-500',
    animate: true,
  },
  mapping: {
    icon: Sparkles,
    label: 'Mapping to form fields',
    color: 'text-purple-500',
    animate: true,
  },
  complete: {
    icon: CheckCircle,
    label: 'Complete',
    color: 'text-green-500',
  },
  error: {
    icon: XCircle,
    label: 'Error',
    color: 'text-red-500',
  },
};

export function ProcessingStatus({
  stage,
  progress,
  message,
  error,
  className,
}: ProcessingStatusProps) {
  const config = stageConfig[stage];
  const Icon = config.icon;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-3">
        {config.animate ? (
          <Loader2 className={cn('h-5 w-5 animate-spin', config.color)} />
        ) : (
          <Icon className={cn('h-5 w-5', config.color)} />
        )}
        <div className="flex-1">
          <p className={cn('font-medium', config.color)}>{config.label}</p>
          {message && (
            <p className="text-sm text-slate-500">{message}</p>
          )}
          {error && stage === 'error' && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>
      </div>

      {progress !== undefined && stage !== 'idle' && stage !== 'complete' && stage !== 'error' && (
        <Progress value={progress} className="h-2" />
      )}
    </div>
  );
}

interface ProcessingStepsProps {
  currentStage: ProcessingStage;
  className?: string;
}

const analysisSteps = [
  { stage: 'validating' as ProcessingStage, label: 'Validate' },
  { stage: 'detecting_type' as ProcessingStage, label: 'Detect Type' },
  { stage: 'extracting' as ProcessingStage, label: 'Extract' },
];

const autofillSteps = [
  { stage: 'analyzing' as ProcessingStage, label: 'Gather Data' },
  { stage: 'mapping' as ProcessingStage, label: 'Map Fields' },
  { stage: 'complete' as ProcessingStage, label: 'Complete' },
];

export function ProcessingSteps({ currentStage, className }: ProcessingStepsProps) {
  const isAutofill = ['analyzing', 'mapping'].includes(currentStage);
  const steps = isAutofill ? autofillSteps : analysisSteps;

  const getStepStatus = (stepStage: ProcessingStage) => {
    const stageOrder = steps.map((s) => s.stage);
    const currentIndex = stageOrder.indexOf(currentStage);
    const stepIndex = stageOrder.indexOf(stepStage);

    if (currentStage === 'error') return 'error';
    if (currentStage === 'complete') return 'complete';
    if (stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  return (
    <div className={cn('flex items-center justify-between', className)}>
      {steps.map((step, index) => {
        const status = getStepStatus(step.stage);
        return (
          <div key={step.stage} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                  status === 'complete' && 'bg-green-100 text-green-600',
                  status === 'current' && 'bg-blue-100 text-blue-600',
                  status === 'pending' && 'bg-slate-100 text-slate-400',
                  status === 'error' && 'bg-red-100 text-red-600'
                )}
              >
                {status === 'complete' ? (
                  <CheckCircle className="h-5 w-5" />
                ) : status === 'current' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : status === 'error' ? (
                  <XCircle className="h-5 w-5" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  'text-xs mt-1',
                  status === 'current' ? 'text-blue-600 font-medium' : 'text-slate-500'
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'w-12 h-0.5 mx-2',
                  getStepStatus(steps[index + 1].stage) === 'pending'
                    ? 'bg-slate-200'
                    : 'bg-green-300'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
