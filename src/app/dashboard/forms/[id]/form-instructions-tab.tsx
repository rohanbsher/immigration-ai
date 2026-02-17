'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';
import type { FormDefinition } from '@/lib/forms/definitions';

interface FormInstructionsTabProps {
  formDefinition: FormDefinition;
}

export function FormInstructionsTab({ formDefinition }: FormInstructionsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info size={20} />
          Form Instructions
        </CardTitle>
      </CardHeader>
      <CardContent className="prose prose-slate max-w-none">
        <div className="grid md:grid-cols-3 gap-4 mb-6 not-prose">
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">Estimated Time</p>
            <p className="font-semibold">{formDefinition.estimatedTime || 'N/A'}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">Filing Fee</p>
            <p className="font-semibold">
              {formDefinition.filingFee ? `$${formDefinition.filingFee}` : 'N/A'}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">USCIS Form Number</p>
            <p className="font-semibold">{formDefinition.uscisFormNumber}</p>
          </div>
        </div>
        <p className="whitespace-pre-wrap">{formDefinition.instructions}</p>
      </CardContent>
    </Card>
  );
}
