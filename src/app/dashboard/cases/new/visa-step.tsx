'use client';

import type { VisaType } from '@/types';

export const VISA_TYPES: { value: VisaType; label: string; description: string }[] = [
  {
    value: 'I-130',
    label: 'I-130',
    description: 'Petition for Alien Relative - Sponsor a family member',
  },
  {
    value: 'I-485',
    label: 'I-485',
    description: 'Adjustment of Status - Apply for Green Card while in the U.S.',
  },
  {
    value: 'I-765',
    label: 'I-765',
    description: 'Employment Authorization Document (EAD)',
  },
  {
    value: 'I-131',
    label: 'I-131',
    description: 'Travel Document (Advance Parole)',
  },
  {
    value: 'N-400',
    label: 'N-400',
    description: 'Application for Naturalization - U.S. Citizenship',
  },
  {
    value: 'H1B',
    label: 'H-1B',
    description: 'Specialty Occupation Worker',
  },
  {
    value: 'L1',
    label: 'L-1',
    description: 'Intracompany Transferee',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Other immigration matter',
  },
];

interface VisaStepProps {
  selectedVisaType: VisaType | '';
  onVisaSelect: (visaType: VisaType) => void;
}

export function VisaStep({ selectedVisaType, onVisaSelect }: VisaStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Select Visa Type</h2>
        <p className="text-muted-foreground">
          Choose the type of immigration application for this case.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {VISA_TYPES.map((visa) => (
          <div
            key={visa.value}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
              selectedVisaType === visa.value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-border/80'
            }`}
            onClick={() => onVisaSelect(visa.value)}
          >
            <p className="font-semibold text-foreground">{visa.label}</p>
            <p className="text-sm text-muted-foreground mt-1">{visa.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
