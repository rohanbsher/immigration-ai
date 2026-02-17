'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { FormDefinition } from '@/lib/forms/definitions';

interface FormPreviewTabProps {
  formDefinition: FormDefinition;
  formValues: Record<string, unknown>;
}

export function FormPreviewTab({ formDefinition, formValues }: FormPreviewTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Form Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {formDefinition.sections.map((section) => (
            <div key={section.id}>
              <h3 className="font-semibold text-slate-900 mb-3 pb-2 border-b">
                {section.title}
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                {section.fields.map((field) => {
                  const value = formValues[field.id];
                  if (!value && value !== 0) return null;

                  let displayValue = String(value);
                  if (field.type === 'select' || field.type === 'radio') {
                    const option = field.options?.find((o) => o.value === value);
                    displayValue = option?.label || displayValue;
                  }

                  return (
                    <div key={field.id}>
                      <p className="text-sm text-slate-500">{field.label}</p>
                      <p className="font-medium">{displayValue}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
