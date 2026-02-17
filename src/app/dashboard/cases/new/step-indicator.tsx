'use client';

import { Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface StepDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface StepIndicatorProps {
  steps: StepDefinition[];
  currentStepId: string;
}

export function StepIndicator({ steps, currentStepId }: StepIndicatorProps) {
  const currentStepIndex = steps.findIndex((s) => s.id === currentStepId);

  return (
    <div className="flex items-center justify-between">
      {steps.map((s, index) => {
        const Icon = s.icon;
        const isActive = currentStepId === s.id;
        const isCompleted = currentStepIndex > index;

        return (
          <div key={s.id} className="flex items-center">
            <div
              className={`flex items-center gap-2 ${
                isActive
                  ? 'text-blue-600'
                  : isCompleted
                  ? 'text-green-600'
                  : 'text-slate-400'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isActive
                    ? 'bg-blue-100'
                    : isCompleted
                    ? 'bg-green-100'
                    : 'bg-slate-100'
                }`}
              >
                {isCompleted ? <Check size={20} /> : <Icon size={20} />}
              </div>
              <span className="hidden sm:block font-medium">{s.label}</span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-12 sm:w-24 h-1 mx-2 rounded ${
                  isCompleted ? 'bg-green-400' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
