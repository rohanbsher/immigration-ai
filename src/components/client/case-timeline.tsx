'use client';

import { CheckCircle, Circle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CaseTimelineProps {
  caseId: string;
  currentStatus: string;
}

const TIMELINE_STEPS = [
  { status: 'intake', label: 'Case Opened', description: 'Initial consultation completed' },
  { status: 'document_collection', label: 'Document Collection', description: 'Gathering required documents' },
  { status: 'document_review', label: 'Document Review', description: 'Attorney reviewing documents' },
  { status: 'form_preparation', label: 'Form Preparation', description: 'Preparing immigration forms' },
  { status: 'client_review', label: 'Client Review', description: 'Awaiting your review and approval' },
  { status: 'ready_to_file', label: 'Ready to File', description: 'All documents ready for submission' },
  { status: 'filed', label: 'Filed', description: 'Application submitted to USCIS' },
  { status: 'approved', label: 'Approved', description: 'Application approved' },
];

function getStepStatus(stepStatus: string, currentStatus: string): 'completed' | 'current' | 'upcoming' {
  const statusOrder = TIMELINE_STEPS.map(s => s.status);
  const currentIndex = statusOrder.indexOf(currentStatus);
  const stepIndex = statusOrder.indexOf(stepStatus);

  if (stepIndex < currentIndex) return 'completed';
  if (stepIndex === currentIndex) return 'current';
  return 'upcoming';
}

export function CaseTimeline({ currentStatus }: CaseTimelineProps) {
  return (
    <div className="relative">
      <h4 className="text-sm font-medium mb-4">Case Progress</h4>

      <div className="relative">
        {TIMELINE_STEPS.map((step, index) => {
          const status = getStepStatus(step.status, currentStatus);
          const isLast = index === TIMELINE_STEPS.length - 1;

          return (
            <div key={step.status} className="flex gap-4 pb-6 last:pb-0">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2',
                    status === 'completed' && 'bg-primary border-primary text-primary-foreground',
                    status === 'current' && 'bg-primary/10 border-primary text-primary',
                    status === 'upcoming' && 'bg-muted border-muted-foreground/20 text-muted-foreground'
                  )}
                >
                  {status === 'completed' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : status === 'current' ? (
                    <Clock className="h-4 w-4" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </div>
                {!isLast && (
                  <div
                    className={cn(
                      'w-0.5 flex-1 min-h-[24px]',
                      status === 'completed' ? 'bg-primary' : 'bg-muted-foreground/20'
                    )}
                  />
                )}
              </div>

              <div className="flex-1 pt-1">
                <h5
                  className={cn(
                    'text-sm font-medium',
                    status === 'upcoming' && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </h5>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
